import Vue from "vue";
import Vuex from "vuex";
import Platform3DSpace from "../js/Platform3DSpace";

Vue.use(Vuex);

// init store
export const store = new Vuex.Store({
    state: {
        objectList: [],
        loading: false,
        loadingTitle: "",
        searchText: "",
        subscribed: false,
        numRecentItems: 0,
        details: {},
        taggerProxy: null,
        subscribeToClick: false,
        selectedObject: null

    },
    // getters are used to compute a derived state based on the store
    getters: {
        object: (state) => state.selectedObject
    },
    // mutations are syncronous events that change the state of the store
    mutations: {
        // show the loading overlay
        loading(state, text) {
            state.loading = true;
            if (text) state.loadingTitle = text;
        },
        setSelectedObject(state, object) {
            console.log("SET SELECTED OBJECT", object);
            state.selectedObject = object;
        },
        // hide the loading overlay
        loadingComplete(state) {
            state.loading = false;
            state.loadingTitle = "";
        },
        // add an item to the store list that was captured via the selection event
        addItem(state, object) {
            // add object to front of list
            state.objectList.unshift(object);

            // enforce num recent items preferences by trimming list as necessary
            if (state.objectList.length > state.numRecentItems) {
                state.objectList.splice(state.numRecentItems);
            }

            // transform objectlist into 6w tags and update tagger
            if (state.taggerProxy) {
                const tags = {};
                state.objectList.forEach(object => {
                    tags[object.id] = [];
                    tags[object.id].push({
                        object: object.type,
                        sixw: "ds6w:what/DEMO Type",
                        dispValue: object.type
                    });
                    tags[object.id].push({
                        object: object.label,
                        sixw: "ds6w:what/DEMO Name",
                        dispValue: object.label
                    });
                    tags[object.id].push({
                        object: object.id,
                        sixw: "ds6w:what/DEMO Id",
                        dispValue: object.id
                    });
                });
                state.taggerProxy.setSubjectsTags(tags);
            }
        },
        // update the text typed into the filter bar
        searchText(state, text) {
            state.searchText = text;
        },
        // clear the objects and details from the view
        clearSelections(state) {
            state.objectList = [];
            state.details = {};
        },
        // internal mechanism to track that widget instance has subscribed to
        // event
        subscribed(state) {
            state.subscribed = true;
        },
        // create 6w tagger proxy
        createTaggerProxy(state, TagNavigatorProxy) {
            if (!state.taggerProxy) {
                const options = {
                    widgetId: widget.id,
                    filteringMode: "WithFilteringServices"
                };
                state.taggerProxy = TagNavigatorProxy.createProxy(options);
            }
        },
        // update the recent items based on the preference set in the widget
        setNumRecentItems(state, num) {
            state.numRecentItems = num;
            if (state.objectList && state.objectList.length > state.numRecentItems) {
                state.objectList.splice(state.numRecentItems);
            }
        },
        // set the object details
        setObjectDetails(state, details) {
            console.log("SET OBJECT DETAILS", details);
            state.details = details;
        },
        // enable or disable subscribe to click
        setSubscribeToClick(state, show) {
            if (!show || show === "false") {
                state.subscribeToClick = false;
            } else {
                state.subscribeToClick = true;
            }
        }
    },
    // actions are asyncronous modifications to the state based on user interactions
    actions: {
        // subscribe to the DS widget click event
        subscribeToClickEvent({ commit, state, dispatch }) {
            // check if widget instance is already subscribed.
            if (!state.subscribed) {
                commit("subscribed");
                requirejs(["DS/PlatformAPI/PlatformAPI"], PlatformAPI => {
                    PlatformAPI.subscribe("DS/PADUtils/PADCommandProxy/select", content => {
                        // if preference is disabled do nothing
                        if (!state.subscribeToClick) {
                            return;
                        }

                        // Nothing selected
                        if (content.data.paths.length === 0) {
                            return;
                        }

                        // Get the physical ID from the path
                        // There may be multiple elements in the PATH representing
                        // the full structure PATH if from a indented table.  The selected
                        // node is always the last one in the array
                        const path = content.data.paths[content.data.paths.length - 1];
                        const objectId = path[path.length - 1];
                        let objectType = "";
                        let objectLabel = "";

                        // If the attributes object has an element for the selected
                        // item then get its type and label
                        if (content.data.attributes[objectId]) {
                            objectType = content.data.attributes[objectId].type;
                            objectLabel = content.data.attributes[objectId].label;
                        }

                        // add item to the table list
                        if (objectId.length > 0) {
                            commit("addItem", {
                                id: objectId,
                                type: objectType,
                                label: objectLabel
                            });
                        }
                    });
                });
            }
        },
        updateItemTable({ commit }, item) {
            if (!item) {
                return;
            }

            const objectId = item.objectId;
            let displayType = item.displayType;
            const displayName = item.displayName;



            // add item to the table list
            if (objectId.length > 0) {
                commit("addItem", {
                    id: objectId,
                    type: displayType,
                    label: displayName
                });
            }
        },
        // initialize the DS 6W tagger proxy
        init6WTagger({ commit, state }) {
            requirejs(["DS/TagNavigatorProxy/TagNavigatorProxy"], TagNavigatorProxy => {
                // 6W Tagger proxy creation
                commit("createTaggerProxy", TagNavigatorProxy);

                // provide the callback function when 6w tag is selected
                state.taggerProxy.addEvent("onFilterSubjectsChange", filters => {
                    if (filters.filteredSubjectList && filters.filteredSubjectList.length > 0) {
                        this._vm.$awn.info(`Filtered Objects: ${filters.filteredSubjectList.join(", ")}`);
                    }
                });
            });
        },
        getObjectDetails({ commit, getters }) {
            const object = getters.object;
            if (!object || !object.id || !object.type) {
                console.warn("🛑 Eksik object bilgisi:", object);
                return;
            }

            console.log("📥 Detay isteniyor:", object);
            commit("loading");

            // Obje tipine göre servis URL'sini belirle
            let serviceUrl = "";
            
            switch (object.type) {
                case "Change Action":
                    serviceUrl = `/resources/v1/modeler/dscm/changeaction/${object.id}?$fields=members,proposedChanges,realizedChanges,referentials,contexts,flowDown,governingChanges,customerAttributes`;
                    break;
                case "Change Order":
                    serviceUrl = `/resources/v1/modeler/dscm/changeorder/${object.id}?$fields=members,proposedChanges,realizedChanges,referentials,contexts,flowDown,governingChanges,customerAttributes`;
                    break;
                case "Change Request":
                    serviceUrl = `/resources/v1/modeler/dscm/changerequest/${object.id}?$fields=members,proposedChanges,realizedChanges,referentials,contexts,flowDown,governingChanges,customerAttributes`;
                    break;
                case "Issue":
                    serviceUrl = `/resources/v1/modeler/dsiss/issue/${object.id}?$mask=dsmveng:EngItemMask.Details`;
                    break;
                default:
                    console.warn("❓ Bilinmeyen tip:", object.type);
                    commit("loadingComplete");
                    return;
            }

            console.log(`🔗 ${object.type} için servis çağrısı:`, serviceUrl);

            // Ana servis çağrısı yap
            Platform3DSpace.call3DSpace({ method: "GET", url: serviceUrl, type: "json" })
                .then(response => {
                    console.log(`📄 ${object.type} raw response:`, response);
                    
                    let mainDetails = {};
                    
                    // Response'da data array'i var mı kontrol et
                    if (response && response.data && Array.isArray(response.data) && response.data[0]) {
                        console.log(`📄 ${object.type} response data[0]:`, response.data[0]);
                        mainDetails = response.data[0];
                    } 
                    // Response'da data array'i yoksa, response'un kendisini kullan
                    else if (response && (response.id || response.title || response.type)) {
                        console.log(`📄 ${object.type} response direkt:`, response);
                        mainDetails = response;
                    } 
                    else {
                        console.log(`⚠️ ${object.type} boş geldi:`, response);
                        commit("setObjectDetails", {});
                        return;
                    }

                    // Change Action için VPMReference ve Drawing detaylarını al
                    if (object.type === "Change Action" && mainDetails.proposedChanges) {
                        const vpmRequests = mainDetails.proposedChanges
                            .filter(change => change.where && change.where.type === "VPMReference")
                            .map(change => ({
                                changeId: change.internalid,
                                vpmId: change.where.identifier,
                                promise: Platform3DSpace.call3DSpace({ 
                                    method: "GET", 
                                    url: `/resources/v1/modeler/dseng/dseng:EngItem/${change.where.identifier}?xrequestedwith=xmlhttprequest`, 
                                    type: "json" 
                                })
                            }));

                        const drawingRequests = mainDetails.proposedChanges
                            .filter(change => change.where && change.where.type === "Drawing")
                            .map(change => ({
                                changeId: change.internalid,
                                drawingPath: change.where.relativePath,
                                promise: Platform3DSpace.call3DSpace({ 
                                    method: "GET", 
                                    url: `${change.where.relativePath}?xrequestedwith=xmlhttprequest`, 
                                    type: "json" 
                                })
                            }));

                        const allRequests = [...vpmRequests, ...drawingRequests];

                        if (allRequests.length > 0) {
                            console.log(`🔗 ${vpmRequests.length} VPMReference ve ${drawingRequests.length} Drawing detayı alınıyor...`);
                            
                            Promise.all(allRequests.map(req => req.promise))
                                .then(responses => {
                                    // VPM detaylarını proposed changes'e ekle
                                    vpmRequests.forEach((vpmRequest, index) => {
                                        const changeId = vpmRequest.changeId;
                                        const change = mainDetails.proposedChanges.find(c => c.internalid === changeId);
                                        const vpmResponse = responses[index];
                                        
                                        if (change && vpmResponse && vpmResponse.member && vpmResponse.member[0]) {
                                            change.vpmDetails = vpmResponse.member[0];
                                            console.log(`📄 VPM detayı eklendi:`, change.vpmDetails);
                                        }
                                    });

                                    // Drawing detaylarını proposed changes'e ekle
                                    drawingRequests.forEach((drawingRequest, index) => {
                                        const changeId = drawingRequest.changeId;
                                        const change = mainDetails.proposedChanges.find(c => c.internalid === changeId);
                                        const drawingResponse = responses[vpmRequests.length + index];
                                        
                                        if (change && drawingResponse && drawingResponse.member && drawingResponse.member[0]) {
                                            change.drawingDetails = drawingResponse.member[0];
                                            console.log(`📄 Drawing detayı eklendi:`, change.drawingDetails);
                                        }
                                    });
                                    
                                    commit("setObjectDetails", mainDetails);
                                })
                                .catch(err => {
                                    console.error("❌ VPM/Drawing detayları alınırken hata:", err);
                                    commit("setObjectDetails", mainDetails);
                                });
                        } else {
                            commit("setObjectDetails", mainDetails);
                        }
                    } else {
                        commit("setObjectDetails", mainDetails);
                    }

                    // Ecosystem servisi çağrısı - Route Templates ve Routes için
                    const ecosystemRequest = {
                        label: "randomstring",
                        responseMode: "ObjectsAndLinks",
                        items: [
                            {
                                id: object.id,
                                relTypesTaxonomies: `types/${object.type.replace(/ /g, '/')}`,
                                serviceId: "3DSpace",
                                type: object.type
                            }
                        ],
                        relations: [
                            "Object_Route_from"
                        ]
                    };

                    console.log("🔗 Ecosystem servisi çağrılıyor:", ecosystemRequest);

                    Platform3DSpace.call3DSpace({
                        method: "POST",
                        url: "/resources/enorelnav/v2/navigate/getEcosystem?tenant=OnPremise&xrequestedwith=xmlhttprequest",
                        type: "json",
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Origin': 'https://3ddashboard25x.metaplm.com',
                            'Referer': 'https://3ddashboard25x.metaplm.com/',
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-site'
                        },
                        data: ecosystemRequest
                    })
                    .then(ecosystemResponse => {
                        console.log("📄 Ecosystem response:", ecosystemResponse);
                        
                        if (ecosystemResponse && ecosystemResponse.objects) {
                            // Route Templates ve Routes'ları filtrele
                            const routeTemplates = ecosystemResponse.objects.filter(obj => obj.type === "Route Template");
                            const routes = ecosystemResponse.objects.filter(obj => obj.type === "Route");
                            
                            console.log("📋 Route Templates:", routeTemplates);
                            console.log("📋 Routes:", routes);
                            
                            // mainDetails'e ekle
                            if (!mainDetails.ecosystem) {
                                mainDetails.ecosystem = {};
                            }
                            mainDetails.ecosystem.routeTemplates = routeTemplates;
                            mainDetails.ecosystem.routes = routes;
                            
                            // setObjectDetails'i tekrar çağır güncellenmiş verilerle
                            commit("setObjectDetails", mainDetails);
                        }
                    })
                    .catch(err => {
                        console.error("❌ Ecosystem servisi hatası:", err);
                        // Hata olsa bile ana detayları kaydet
                        commit("setObjectDetails", mainDetails);
                    });

                })
                .catch((err) => {
                    console.error("❌ Detay getirme hatası:", err);
                    this._vm.$awn.alert(err);
                })
                .finally(() => {
                    commit("loadingComplete");
                });
        }





    }
});
