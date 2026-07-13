/**
 * Security Context gathering
 * Call 3DSpace code
 *
 * At change of tenant reload the right Security Contexts
 *
 * Hook to detect change of Security Context
 *
 * As a singleton in the widget
 */

import PlatformInterface from "./PlatformInterface";

const wdgPrefEnoCtx = "__enoCtx";

const hooks = {
    onSecurityContextChange: []
};

let currentSecCtx = "";
let currentCSRFToken = "";
const secCtxByTenantCache = {};

function initPrefs() {
    const prefEnoCtx = widget.getPreference(wdgPrefEnoCtx);
    if (typeof prefEnoCtx === "undefined") {
        // Create it
        widget.addPreference({
            name: wdgPrefEnoCtx,
            type: "text",
            label: "Credentials",
            defaultValue: "",
            onchange: "onChangeSecurityContext"
        });
    }

    currentSecCtx = widget.getValue(wdgPrefEnoCtx);
    widget.addEvent("onChangeSecurityContext", onChangeSecurityContext);
}

function updateEnoCtxPref() {
    const tenant = PlatformInterface.getCurrentTenant();
    const enoCtxInfos = Platform3DSpace.getSecurityContextForTenant(tenant);

    // Save last selected SecCtx to check later if is still in the list
    const lastSecCtxSelected = widget.getValue(wdgPrefEnoCtx);
    let bLastSecCtxStillExist = false;

    const prefEnoCtx = widget.getPreference(wdgPrefEnoCtx);
    prefEnoCtx.type = "list";

    prefEnoCtx.options = enoCtxInfos.collabspaces.reduce((arrResult, itemCS) => {
        itemCS.couples.forEach(coupleRoleOrg => {
            const { role, organization } = coupleRoleOrg;
            arrResult.push({
                label: `${role.nls || role.name}.${organization.name}.${itemCS.name}`,
                value: `${role.name}.${organization.name}.${itemCS.name}`
            });
            if (lastSecCtxSelected === `${role.name}.${organization.name}.${itemCS.name}`) {
                bLastSecCtxStillExist = true;
            }
        });
        return arrResult;
    }, []);

    if (bLastSecCtxStillExist) {
        prefEnoCtx.defaultValue = lastSecCtxSelected;
    } else {
        // Use the prefered credentials
        const { collabspace, role, organization } = enoCtxInfos.preferredcredentials;
        if (collabspace && organization && role) {
            prefEnoCtx.defaultValue = `${role.name}.${organization.name}.${collabspace.name}`;
        } else if (prefEnoCtx.options && prefEnoCtx.options.length > 0) {
            prefEnoCtx.defaultValue = prefEnoCtx.options[0].value;
        }
    }

    widget.addPreference(prefEnoCtx);
    widget.setValue(wdgPrefEnoCtx, prefEnoCtx.defaultValue);
    currentSecCtx = prefEnoCtx.defaultValue;
}

function onChangeSecurityContext(namePref, valPref) {
    if (namePref === wdgPrefEnoCtx) {
        currentSecCtx = valPref;
        hooks.onSecurityContextChange.forEach(cbFct => {
            cbFct(currentSecCtx);
        });
    }
}

const Platform3DSpace = {
    isLoaded() {
        const tenant = PlatformInterface.getCurrentTenant();
        const enoCtxInfos = Platform3DSpace.getSecurityContextForTenant(tenant);
        if (enoCtxInfos) {
            return true;
        }
        return false;
    },

    getSecurityContextForTenant(tenant) {
        return secCtxByTenantCache[tenant];
    },

    loadSecurityContexts() {
        return new Promise((resolve, reject) => {
            const loadSecCtx = () => {
                const tenant = PlatformInterface.getCurrentTenant();
                const url3DSpace = PlatformInterface.getUrlForTenantAndService(tenant, "3DSpace");
                if (!url3DSpace || url3DSpace === "") {
                    reject(new Error(`Impossible to retrieve 3DSpace url for tenant ${tenant}`));
                } else {
                    // Call 3DSpace server to get Security Contexts from OOTB Web Service
                    const servicePath = `/resources/modeler/pno/person?current=true&select=preferredcredentials&select=collabspaces&select=firstname&select=lastname&tenant=${tenant}`;
                    // Call
                    requirejs(["DS/WAFData/WAFData"], WAFData => {
                        WAFData.authenticatedRequest(url3DSpace + servicePath, {
                            method: "GET",
                            headers: {
                                SecurityContext: ""
                            },
                            data: {},
                            type: "json",
                            onComplete: response => {
                                secCtxByTenantCache[tenant] = response;

                                updateEnoCtxPref();
                                resolve();
                            },
                            onFailure: error => {
                                // P&O web services are not supported in 16x.  Make this a soft failure with
                                // a warning to console.
                                console.warn(error);
                                console.warn("WARNING: Error while calling the Web Service to retrieve the Security Contexts.  Any web service calls requiring Security Context will fail");
                                resolve();
                            }
                        });
                    });

                    // Call 3dspace server to get the CSRF token for any PUT, POST, OR DELETE calls
                    const csrfPath = "/resources/v1/application/CSRF";
                    // Call
                    requirejs(["DS/WAFData/WAFData"], WAFData => {
                        WAFData.authenticatedRequest(url3DSpace + csrfPath, {
                            method: "GET",
                            headers: {
                                SecurityContext: ""
                            },
                            data: {},
                            type: "json",
                            onComplete: response => {
                                if (response.success === "false") {
                                    reject(new Error("Error calling the Web Service to retrieve the CSRF token"), response);
                                } else {
                                    currentCSRFToken = response.csrf.value;
                                }
                                resolve();
                            },
                            onFailure: error => {
                                reject(new Error("Error calling the Web Service to retrieve the CSRF token"), error);
                            }
                        });
                    });
                }
            };
            if (!PlatformInterface.isLoaded()) {
                PlatformInterface.reload3DExpUrls().then(() => {
                    loadSecCtx();
                });
            } else {
                loadSecCtx();
            }
        });
    },
    waitUntilSecurityContextSet(maxWait) {
        const timeStart = new Date();
        return new Promise((resolve, reject) => {
            const wait = setInterval(() => {
                if (currentSecCtx !== "") {
                    // found security context
                    clearInterval(wait);
                    resolve();
                } else if (new Date() - timeStart > maxWait) {
                    // exceeded max wait time so throw error
                    clearInterval(wait);
                    reject(new Error("securitycontext was not set within max time: " + maxWait + "(ms)"));
                }
                // continue to wait
            }, 200);
        });
    },
    call3DSpace({
        tenant,
        url,
        method = "GET",
        headers = {},
        data,
        type,
        dataType,
        includePlatform = false,
        includeCSRF = false
    }) {
        return new Promise((resolve, reject) => {
            const doCall = () => {
                this.waitUntilSecurityContextSet(10000).then(() => {
                    console.log("executing call3DSpace");
                    tenant = PlatformInterface.getCurrentTenant();
                    const url3DSpace = PlatformInterface.getUrlForTenantAndService(tenant, "3DSpace");
                    headers.SecurityContext = currentSecCtx;
                    if (includeCSRF || method === "POST" || method === "PATCH" || method === "PUT") {
                        headers.ENO_CSRF_TOKEN = currentCSRFToken;
                    }

                    if (!url3DSpace) {
                        reject(new Error(`No 3DSpace url found for the tenant: ${tenant}`));
                    }

                    if (includePlatform) url += "&platform=" + tenant;
                    PlatformInterface.callWebService({
                        method: method,
                        url: url3DSpace + url,
                        headers: headers,
                        data: data,
                        type: type,
                        dataType: dataType
                    })
                    .then((response) => {
                            if (response.body.error) {
                                throw new Error(response.body.error);
                            } else {
                                resolve(response.body);
                            }
                    })
                    .catch(error => {
                        console.error(error);
                        reject(error);
                    });
                })
                .catch(error => {
                    reject(error);
                });
            };
            if (!Platform3DSpace.isLoaded()) {
                Platform3DSpace.loadSecurityContexts()
                    .then(() => {
                        doCall();
                    })
                    .catch((errs) => {
                        console.error(errs);
                        reject(errs);
                    });
            } else {
                doCall();
            }
        });
    }
};

initPrefs();

PlatformInterface.addEventListener("onTenantChange", () => {
    Platform3DSpace.loadSecurityContexts()
        .then(() => {
            widget.dispatchEvent("onEdit");
        })
        .catch((...errs) => {
            console.error(...errs);
        });
});

Platform3DSpace.loadSecurityContexts().catch((...errs) => {
    console.error(...errs);
});

export default Platform3DSpace;
