// ==UserScript==
// @name         queslar-ui-ux
// @namespace    http://tampermonkey.net/
// @version      0.12
// @description  UI/UX extension for Queslar PBBG
// @author       Daniel Xie
// @include      https://*queslar.com*
// @run-at       document-end
// @connect      githubusercontent.com
// @connect      github.com
// @connect      self
// @grant        none
// ==/UserScript==

// https://github.com/danielyxie/queslar-ui-ux-extension/blob/main/README.md

/*
 * Potential future features:
 * Could parse through log "playerActivityLogService" and notify for certain events like market orders being filled
 * 
 */

(function () {
    'use strict';

    function notify(msg) {
        // Notification
        if (Notification.permission === "granted") {
            new Notification(msg);
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                // If the user accepts, let's create a notification
                if (permission === "granted") {
                    new Notification(msg);
                }
            });
        }
    }

    const PLAYER_IDS = {
        Screenshot: 1317,
        trgKai: 1896,
        kormara: 1421,
    };

    // Modify the WebSocket API so that we can intercept Queslar's WebSocket messages.
    // This might let us do something with it later
    (function () {
        var OrigWebSocket = window.WebSocket;
        var callWebSocket = OrigWebSocket.apply.bind(OrigWebSocket);
        var wsAddListener = OrigWebSocket.prototype.addEventListener;
        wsAddListener = wsAddListener.call.bind(wsAddListener);
        window.WebSocket = function WebSocket(url, protocols) {
            var ws;
            if (!(this instanceof WebSocket)) {
                // Called without 'new' (browsers will throw an error).
                ws = callWebSocket(this, arguments);
            } else if (arguments.length === 1) {
                ws = new OrigWebSocket(url);
            } else if (arguments.length >= 2) {
                ws = new OrigWebSocket(url, protocols);
            } else { // No arguments (browsers will throw an error)
                ws = new OrigWebSocket();
            }

            wsAddListener(ws, 'message', function (event) {
                // This doesn't work because it only picks up your price changes, shame
                /*
                const msg = event.data;

                // Ideally we'd do some processing here to convert the websocket data to real structures,
                // but some basic string parsing should be fine for now 
                if (msg.includes("crafting data")) {
                    console.log(`Crafting data message detected: ${msg}`);

                    const regexMatch = msg.match(/"price_value":(\d+)/);
                    if (regexMatch == null || regexMatch.length !== 2) {
                        console.warn(`Regex failed to parse price_value for crafting data message: ${msg}`);
                        return;
                    }

                    // TODO make this more human readable in the future
                    const newPrice = regexMatch[1];

                    if (msg.includes(`"username":"Screenshot"`)) {
                        notify(`Screenshot price -> ${newPrice}`);
                    } else if (msg.includes(`"username":"kormara"`)) {
                        notify(`kormara price -> ${newPrice}`);
                    } else if (msg.includes(`"username":"trgKai"`)) {
                        notify(`trgKai price -> ${newPrice}`);
                    } else if (msg.includes(`"username":"Saitama"`)) {
                        notify(`Saitama price -> ${newPrice}`);
                    } else if (msg.includes(`"username":"Ender"`)) {
                        notify(`Ender price -> ${newPrice}`);
                    }
                }
                */
            });
            return ws;
        }.bind();
        window.WebSocket.prototype = OrigWebSocket.prototype;
        window.WebSocket.prototype.constructor = window.WebSocket;

        var wsSend = OrigWebSocket.prototype.send;
        wsSend = wsSend.apply.bind(wsSend);
        OrigWebSocket.prototype.send = function (data) {
            // TODO: Do something with the sent data if you wish.
            return wsSend(this, arguments);
        };
    })();

    // Store as much DOM shit as possible up front for performance reasons

    let gameContentContainer;
    let upperProfileContainer;
    let inventoryMenuContainer;
    let leftMenu;
    let upperMenu;
    let upperMenuToolbar;
    let chatContainer;
    let overlayContainer;
    let extensionToolbar;
    let extensionToolbarButtons;
    let extensionToolbarText;

    let initialized = false;
    
    function setToolbarText(txt) {
        extensionToolbarText.textContent = txt;
    }

    function addToolbarText(txt) {
        extensionToolbarText.textContent = `${extensionToolbarText.textContent}, ${txt}`;
    }

    function createToolbarLink(txt, href) {
        const link = document.createElement("a");
        link.innerText = txt;
        link.href = href;

        return link;
    }

    function createToolbarButton(txt) {
        const button = document.createElement("button");
        button.style.height = "35px";
        if (txt) {
            button.textContent = txt;
        }
    
        return button;
    }

    // Switch to gearset. Argument must be 1, 2, or 3
    function equipGearSet(setValue) {
        if (![1, 2, 3].includes(setValue)) {
            console.error(`Invalid value passed to equipGearSet(): ${setValue}`);
        }

        const bodyData = {
            setValue: setValue
        };

        let params = {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(bodyData)
        }

        fetch(`${window.location.origin}/inventory/equip-gear-set`, params).then(data => {
            console.log(data);
            return data.json();
        }).then(res => {
            // There's a bug where sometimes when you switch equipment sets it doesn't properly work (only some of the 
            // equipment from the desired gear set are actually equipped), even if the server says the gear set switch 
            // was successful. Lets check to make sure everything is proper here and report in case anything went wrong.
            // We need to wait a second or two before checking this so that the game's app data has up-to-date information
            setTimeout(() => checkThatGearSetIsProperlyEquipped(setValue), 1e3);
        }).catch(e => {
            notify(`Equip Gear Set request failed: ${e}`)
        });
    }

    function checkThatGearSetIsProperlyEquipped(setValue) {
        const equippedItems = getInventoryData()?.equippedItems?.items;

        // Search through all equipped items. If any of them don't belong to the proper gear set, we'll send 
        // a notification with an error
        let bugDetected = false;
        for (let i = 0; i < equippedItems.length; ++i) {
            if (equippedItems[i]?.item != null && equippedItems[i]?.item?.gear_set !== setValue) {
                bugDetected = true;
                console.log(equippedItems);
                console.log(i);
                break;
            }
        }

        if (bugDetected) {
            notify("WARNING: Equip Gear Set request succeeded, but it appears a bug occurred and equipment was not properly equipped. Please check and manually fix");
        } else {
            notify(`SUCCESSFULLY switched gear set. You have ${equippedItems.length} items equipped`);
        }
    }

    // Determine the page currently being viewed. Page is a link on the left-hand "Menu". 
    // e.g. "Actions", "Party", "Fighter", etc.
    // This is brittle and if Blah changes the naming of the menu components this will break.
    function getViewedPage() {
        // Search children of the game content container until we find the first one that starts with "app-". This is 
        // the page content container
        for (let i = 0; i < gameContentContainer.children.length; ++i) {
            const elem = gameContentContainer.children[i];

            if (elem.localName.startsWith('app-')) {
                return elem.localName.split('-')[1];
            }
        }
        
        return null;
    }

    // Return HTMLElement of the tab content container for the tab currently being used. 
    // A tab is a header in the central game menu.
    // The tabs are different on each page. This is brittle and if Blah changes the name of the menu
    // components this will break
    function getViewedTabContainer() {
        // Get the page content container component based on the name of the current page
        const pageName = getViewedPage();
        const componentNameToSearchFor = `app-${pageName}`;
        const pageContentContainer = gameContentContainer.querySelector(componentNameToSearchFor);

        if (pageContentContainer == null) {
            return null;
        }

        // Search children of the page content container until we find a component that starts with "app-". This is the 
        // tab content container.
        for (let i = 0; pageContentContainer.children.length; ++i) {
            const elem = pageContentContainer.children[i];

            if (elem.localName.startsWith("app-")) {
                return elem;
            }
        }

        return null;
    }

    // Determine the tab currently being viewed. A tab is a header in the central game menu.
    // The tabs are different on each page. This is brittle and if Blah changes the name of the menu
    // components this will break
    function getViewedTab() {
        return getViewedTabContainer()?.localName?.split('-')[1];
    }

    // Adds an Element to the main central menu. This is typically used to add additional tabs
    function addElementToGameContentMenu(elem) {
        let headerParentSearch = document.getElementsByClassName('d-flex flex-row bd-highlight main-color under-menu-title');
        if (headerParentSearch.length !== 1) {
            console.error("Cant find Header parent. Failed to add element to game content menu");
            return;
        }

        let header = headerParentSearch[0].firstChild;
        if (header == null) {
            console.error("Cant find Header. Failed to add element to game content menu");
            return;
        }

        header.appendChild(elem);
    }

    // Returns the first child Element of the main central menu. Usually used to get a button so we can copy it 
    // and add new buttons
    function getFirstChildElementFromGameContentMenu() {
        let headerParentSearch = document.getElementsByClassName('d-flex flex-row bd-highlight main-color under-menu-title');
        if (headerParentSearch.length !== 1) {
            console.error("Cant find Header parent. Failed to add element to game content menu");
            return;
        }

        let header = headerParentSearch[0].firstChild;
        if (header == null) {
            console.error("Cant find Header. Failed to add element to game content menu");
            return;
        }

        return header.firstChild;
    }

    function getActionsData() {
        return getAllAngularRootElements()?.[0].children?.[1]["__ngContext__"]?.[30]?.playerGeneralService?.playerActionService;
    }

    function getInventoryData() {
        return getAllAngularRootElements()?.[0].children?.[1]["__ngContext__"]?.[30]?.playerGeneralService?.playerInventoryService;
    }

    function getQuestData() {
        return getAllAngularRootElements()?.[0].children?.[1]["__ngContext__"]?.[30]?.playerGeneralService?.playerQuestService;
    }

    function getSettingsData() {
        getAllAngularRootElements()?.[0].children?.[1]["__ngContext__"]?.[30]?.playerGeneralService?.playerSettingsService;
    }


    function getActionsRemaining() {
        return getActionsData()?.actions?.remaining;
    }

    function getCurrentQuestData() {
        return getQuestData()?.currentQuest?.[0];
    }

    function isDoingPartyActions() {
        getActionsData()?.partyService?.isFighting;
    }

    // Currently only works for kill quests and action quests (NOT gold quests)
    function getTimeRemainingToCompleteCurrentQuest(includeSeconds = true) {
        const currentQuestData = getCurrentQuestData();
        if (currentQuestData?.objectiveType === "kills") {
            const killsRemaining = currentQuestData.objectiveAmount - currentQuestData.currentProgress;

            if (getActionsData()?.currentSkill === "battling") {
                return getTimeRemainingToComplete(killsRemaining, includeSeconds);
            }
        } else if (currentQuestData?.objectiveType === "actions") {
            const actionsRemaining = currentQuestData.objectiveAmount - currentQuestData.currentProgress;

            return getTimeRemainingToComplete(actionsRemaining, includeSeconds);
        }

        return "N/A";
    }

    // Returns a formatted string indicating the amount of time it'll take to complete the specified number of actions.
    function getTimeRemainingToComplete(actions, includeSeconds = true) {
        if (typeof actions !== "number") {
            return "N/A";
        }

        let timeSeconds = actions * 6;

        const hours = Math.floor(timeSeconds / 3600);
        timeSeconds %= 3600;
        const minutes = Math.floor(timeSeconds / 60);
        timeSeconds %= 60;
        
        if (includeSeconds) {
            return `${hours}h ${minutes}m ${timeSeconds}s`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }

    // Returns a boolean indicating whether a personal or village quest is active. Works simply by checking for the
    // exclamation mark in the upper-left profile panel lol
    function isQuestActive() {
        const questTab = upperProfileContainer.getElementsByClassName("mat-tab-label-content")?.[1];
        return !questTab.textContent.endsWith('!');
    }

    // We don't want to depend on a DOM mutation to trigger the Inactive Quest Notification, so just set it on a 6s timer
    function pollForInactiveQuest() {
        if (!isQuestActive()) {
            notify("Inactive Queslar quest!")
        }

        setTimeout(pollForInactiveQuest, 6e3);
    }

    let lastPage = null;
    let lastMainMutationTime = 0;

    const mainObserver = new MutationObserver((mutations, obs) => {
        if (!initialized) { return; }

        const now = Date.now();

        // Throttle the processing of mutations for performance reasons
        if (now - lastMainMutationTime < 250) {
            return;
        }

        lastMainMutationTime = now;

        let toolbarTextWasSet = false;

        const currentPage = getViewedPage();
        const questActive = isQuestActive();
        const currentTab = getViewedTab();

        // If we're on the Quests tab (which is in the Actions page) and we don't have a quest, display the amount 
        // of time it takes to complete a quest option. RIght now this only works fo rthe monster kill quests (which 
        // give stat rewards) since that's all I really do
        if (currentPage === "actions" && currentTab === "quests" && !questActive) {
            const tabContainer = getViewedTabContainer();
            const objectCells = tabContainer.getElementsByClassName('mat-cell cdk-cell cdk-column-objective mat-column-objective ng-star-inserted');

            if (objectCells.length === 3) {
                const monsterKillQuest = objectCells[2];

                // Strip commas from the number
                const regexMatch = monsterKillQuest.textContent.replace(',', '').match(/(\d+) monster kills/);
                if (regexMatch?.length === 2) {
                    const timeRemaining = getTimeRemainingToComplete(Number(regexMatch[1]));

                    setToolbarText(`Time needed for Quest 3: ${timeRemaining}`);
                    toolbarTextWasSet = true;
                }
            } else {
                console.warn("Expected 3 quests but there werent")
            }
        }

        // If the toolbar text wasn't set by any of the code above, we default it to show 
        // time-to-fatigue and time-to-quest-completion
        if (!toolbarTextWasSet) {
            const timeToFatigue = getTimeRemainingToComplete(getActionsRemaining(), false);
            setToolbarText(`Time to fatigue: ${timeToFatigue}`);
            addToolbarText(`Time to Quest Completion: ${getTimeRemainingToCompleteCurrentQuest(false)}`);
        }

        // This should go last
        lastPage = currentPage;
    });

    let lastChatMutationTime = 0; 
    const chatObserver = new MutationObserver((mutations, obs) => {
        if (!initialized) { return; }

        const now = Date.now();

        // Throttle the processing of chat mutations for performance reasons and to not potentially spam user with notifications
        if (now - lastChatMutationTime < 15e3) {
            return;
        }

        let chatSpans = chatContainer.querySelectorAll('span');

        for (let i = 0; i < chatSpans.length; ++i) {
            if (chatSpans[i].textContent.match(/\[\d+\] Whispers/)) {
                notify("You have unread whisper(s)");
            }

            if (chatSpans[i].textContent.match(/\[\d+\] System/)) {
                notify("You have unread system message(s)");
            }
        }

        lastChatMutationTime = now;
    });

    const overlayObserver = new MutationObserver((mutations, obs) => {
        if (!initialized) { return; }

        if (overlayContainer.childElementCount === 0) { return; }

        // Delete the Round Information from dungeon fighters overlay. This sometimes causes the popup to resize, which 
        // shifts buttons around and makes it harder to spam dungeons, so we delete it for easier spamming.
        // Hopefully this doesn't have too much performancce impact, we'll have to test it
        const roundInformation = overlayContainer.querySelector("app-fighter-dungeon-battle-screen > mat-dialog-content > div:nth-child(3)");
        if (roundInformation) {
            roundInformation.remove();
        }
    });

    // It looks like the Overlay Container only renders once the user has hovered over the screen itself. Since there's guarantee
    // of this happening when the extension is loaded, we'll use a loop to try and initialize this. This is probably terrible
    // but w.e
    function initializeOverlayContainer() {
        if (overlayContainer != null) { return; }

        overlayContainer = document.getElementsByClassName("cdk-overlay-container")?.[0];

        if (overlayContainer != null) {
            overlayObserver.observe(overlayContainer, {
                childList: true,
                attributes: true,
                subtree: true,
            });

            console.log("Initialized Overlay Container & Observer");
        } else {
            setTimeout(initializeOverlayContainer, 4e3);
        }
    }

    function initialize() {
        if (initialized) {
            return;
        }
        
        gameContentContainer = document.querySelector('app-gamecontent');
        upperProfileContainer = document.querySelector('app-upper-profile');
        inventoryMenuContainer = document.querySelector('app-inventory-menu');

        // There are issues finding this. It probably doesn't get rendered immediately. if it's null, let's wait a few seconds
        // then try to initialize again
        upperMenu = document.querySelector('app-upper-menu');
        if (upperMenu == null) {
            console.log("Failed to initialize Queslar-UI-UX extension. Trying again in 3 seconds...");
            setTimeout(initialize, 3e3);
            return;
        }

        upperMenuToolbar = upperMenu.querySelector('mat-toolbar');
        leftMenu = document.querySelector('app-menu');
        chatContainer = document.querySelector('app-chat-rooms');

        // Create our own custom toolbar right below the main upper menu. We use this to display and info/data/UI 
        // the extension needs
        extensionToolbar = upperMenuToolbar.cloneNode();
        extensionToolbarButtons = document.createElement("span");
        extensionToolbarText = document.createElement("span");
        
        // Add our extension buttons
        const eqGearSet1Button = createToolbarButton("E Gear Set 1");
        eqGearSet1Button.onclick = () => equipGearSet(1);

        const eqGearSet2Button = createToolbarButton("E Gear Set 2");
        eqGearSet2Button.onclick = () => equipGearSet(2);

        const eqGearSet3Button = createToolbarButton("E Gear Set 3");
        eqGearSet3Button.onclick = () => equipGearSet(3);

        extensionToolbarButtons.appendChild(eqGearSet1Button);
        extensionToolbarButtons.appendChild(eqGearSet2Button);
        extensionToolbarButtons.appendChild(eqGearSet3Button);
        
        // Add a button to see Market Listings
        const marketListingsButton = createToolbarButton("My Listings");
        marketListingsButton.onclick = () => {
            window.location = `${window.location.origin}/#/game/market/listings`;
        }

        extensionToolbarButtons.appendChild(marketListingsButton);

        // Add a button to see your service orders 
        const myServiceOrdersButton = createToolbarButton("My Service Orders");
        myServiceOrdersButton.onclick = () => {
            window.location = `${window.location.origin}/#/game/market/service-orders`;
        }

        extensionToolbarButtons.appendChild(myServiceOrdersButton);

        // Add a button to see Crafting Services (so you can check when prices are low)
        const craftingServicesButton = createToolbarButton("Crafting Services");
        craftingServicesButton.onclick = () => {
            window.location = `${window.location.origin}/#/game/market/crafting`;
        }

        extensionToolbarButtons.appendChild(craftingServicesButton);

        // Add everything to the DOM
        extensionToolbar.appendChild(extensionToolbarButtons);
        extensionToolbar.appendChild(extensionToolbarText);
        upperMenu.appendChild(extensionToolbar);

        initializeOverlayContainer();

        mainObserver.observe(gameContentContainer, {
            childList: true,
            attributes: true,
            subtree: true,
        });

        chatObserver.observe(chatContainer, {
            childList: true,
            attributes: true,
            subtree: true,
        });

        pollForInactiveQuest();

        initialized = true;

        console.log("Queslar-UI-UX extension initialized");
    }

    // Wait for DOM to load before starting script
    window.addEventListener('DOMContentLoaded', () => {
        if (!initialized) {
            initialize();
        }
    });

})();
