let PlatformInterface;

if (typeof widget === "undefined") {
  throw new Error("Widget Global variable not available. This application only works inside 3D Dashboard.");
}
  if (!widget) {
    throw new Error("Widget Global variable not available, load this module only once widget is declared.");
  }

  const wdgPrefTenant = "__platformTenant";
  let currentTenant = "";
  let tenantsUrlsCache = {};
  let isLoaded = false;

  const hooks = {
    onTenantChange: []
  };

  function initPrefs() {
    let prefTenants = widget.getPreference(wdgPrefTenant);
    if (typeof prefTenants === "undefined") {
      widget.addPreference({
        name: wdgPrefTenant,
        type: "text",
        label: "3DEXPERIENCE Platform",
        defaultValue: widget.getValue("x3dPlatformId") || ""
      });
    }

    currentTenant = widget.getValue(wdgPrefTenant);
    if (currentTenant === undefined) {
      console.error(wdgPrefTenant + " not set.  trying again.");
      setTimeout(() => {
        currentTenant = widget.getValue(wdgPrefTenant);
      }, 1000);
    }

    prefTenants = widget.getPreference(wdgPrefTenant);
    prefTenants.type = "text";
    prefTenants.onchange = "onChangeConnector3DExpTenant";
    widget.addPreference(prefTenants);
    widget.addEvent("onChangeConnector3DExpTenant", onTenantChanged);
  }

  function onTenantChanged(namePref, valPref) {
    if (namePref === wdgPrefTenant) {
      currentTenant = valPref;
      hooks.onTenantChange.forEach(cbFct => {
        cbFct(currentTenant);
      });
    }
  }

  PlatformInterface = {
    callProxifiedWebService({ method = "GET", url, data, type = "json", headers = {} }) {
      return new Promise((resolve, reject) => {
        if (data && headers["Content-Type"] === "application/json") {
          data = JSON.stringify(data);
        }
        requirejs(["DS/WAFData/WAFData"], WAFData => {
          try {
            WAFData.proxifiedRequest(encodeURI(url), {
              method,
              headers,
              data,
              type,
              onComplete: (body, headers) => {
                if (type === "json") {
                  if (!body || body === null) body = {};
                  resolve({ body, headers });
                } else {
                  resolve(body);
                }
              },
              onFailure: (error, backend) => {
                let errorMessage = "";
                if (backend) {
                  if (backend.error && backend.error.message) errorMessage += ` : ${backend.error.message}`;
                  if (backend.error && backend.error.type) errorMessage += ` : ${backend.error.type}`;
                  if (backend.errorMessage) errorMessage += ` : ${backend.errorMessage}`;
                  if (typeof backend.error === "string") errorMessage += ` : ${backend.error}`;
                  if (backend.internalError) errorMessage += ` : ${backend.internalError}`;
                  if (backend.message) errorMessage += ` : ${backend.message}`;
                  reject(errorMessage || error);
                } else {
                  reject(error);
                }
              },
              onTimeout: error => reject(error)
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    },

    callWebService({ method = "GET", url, data, type = "json", headers = {} }) {
      return new Promise((resolve, reject) => {
        if (data && headers["Content-Type"] === "application/json") {
          data = JSON.stringify(data);
        }
        requirejs(["DS/WAFData/WAFData"], WAFData => {
          WAFData.authenticatedRequest(encodeURI(url), {
            method,
            headers,
            data,
            type,
            onComplete: (body, headers) => {
              if (type === "json") {
                if (!body || body === null) body = {};
                resolve({ body, headers });
              } else {
                resolve(body);
              }
            },
            onFailure: (error, backend) => {
              let errorMessage = "";
              if (backend) {
                if (backend.error && backend.error.message) errorMessage += ` : ${backend.error.message}`;
                if (backend.error && backend.error.type) errorMessage += ` : ${backend.error.type}`;
                if (backend.errorMessage) errorMessage += ` : ${backend.errorMessage}`;
                if (typeof backend.error === "string") errorMessage += ` : ${backend.error}`;
                if (backend.internalError) errorMessage += ` : ${backend.internalError}`;
                if (backend.message) errorMessage += ` : ${backend.message}`;
                reject(errorMessage || error);
              } else {
                reject(error);
              }
            },
            onTimeout: error => reject(error)
          });
        });
      });
    },

    isLoaded() {
      return isLoaded;
    },
    getCurrentTenant() {
      return currentTenant;
    },
    setPreferedTenant(tenant) {
      if (!tenantsUrlsCache[tenant]) {
        throw new Error("Invalid tenant");
      }
      currentTenant = tenant;
      widget.setValue(wdgPrefTenant, tenant);
    },
    getUrlForTenantAndService(tenant, service) {
      if (!tenantsUrlsCache[tenant]) {
        throw new Error("Invalid tenant");
      }
      return tenantsUrlsCache[tenant][service];
    },
    addEventListener(eventName, callbackFct) {
      if (!hooks[eventName]) throw new Error(`Invalid event name '${eventName}'`);
      hooks[eventName].push(callbackFct);
    },
    reload3DExpUrls() {
      isLoaded = false;
      return new Promise((resolve, reject) => {
        requirejs(["DS/i3DXCompassServices/i3DXCompassServices"], i3DXCompassServices => {
          i3DXCompassServices.getPlatformServices({
            onComplete: function(resultsI3DX) {
              try {
                tenantsUrlsCache = resultsI3DX.reduce((map, item) => {
                  map[item.platformId] = { ...item };
                  return map;
                }, {});

                const prefTenants = widget.getPreference(wdgPrefTenant);
                prefTenants.options = resultsI3DX.map(item => ({ label: item.displayName, value: item.platformId }));
                prefTenants.type = "list";
                widget.addPreference(prefTenants);

                const arrTenants = Object.keys(tenantsUrlsCache);
                if (!arrTenants.includes(currentTenant)) {
                  PlatformInterface.setPreferedTenant((currentTenant = arrTenants[0]));
                }

                isLoaded = true;
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            onFailure: function(error) {
              reject(new Error("i3DXCompassServices getPlatformServices onFailure", error));
            }
          });
        });
      });
    }
  };

  initPrefs();

  PlatformInterface.reload3DExpUrls().catch((...errs) => {
    console.error(...errs);
  });

export default PlatformInterface;
