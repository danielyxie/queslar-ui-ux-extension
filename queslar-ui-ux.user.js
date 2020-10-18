// ==UserScript==
// @name         queslar-ui-ux
// @namespace    http://tampermonkey.net/
// @version      0.2
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

(function () {
    'use strict';

    // Store as much DOM shit as possible up front for performance reasons

    let gameContentContainer;
    let upperProfileContainer;
    let inventoryMenuContainer;
    let upperMenu;
    let upperMenuToolbar;
    let chatContainer;

    let initialized = false;

    window.addEventListener('DOMContentLoaded', () => {
        gameContentContainer = document.querySelector('app-gamecontent');
        upperProfileContainer = document.querySelector('app-upper-profile');
        inventoryMenuContainer = document.querySelector('app-inventory-menu');
        upperMenu = document.querySelector('app-upper-menu');
        upperMenuToolbar = upperMenu.querySelector('mat-toolbar');
        chatContainer = document.querySelector('app-chat-rooms');

        // Create our own custom toolbar right below the main upper menu. We use this to display and info/data/UI 
        // the extension needs
        const extensionToolbar = upperMenuToolbar.cloneNode();
        upperMenu.appendChild(extensionToolbar);

        initialized = true;
    });

    function notify(msg){ 
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
    
    function setToolbarText(txt) {
        extensionToolbar.textContent = txt;
    }

    function addToolbarText(txt) {
        extensionToolbar.textContent = `${extensionToolbar.textContent}, ${txt}`;
    }

    // Switch to gearset. Argument must be 1, 2, or 3
    function equipGearSet(setValue) {
        // TODO Could add validation for arg here 

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
            notify(`Successfully switched gear set`)
        }).catch(e => {
            notify(`Switching gear set failed: ${e}`)
        });
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

    function getActionsRemaining() {
        return getActionsData()?.actions?.remaining;
    }

    function getQuestData() {
        return getAllAngularRootElements()?.[0].children?.[1]["__ngContext__"]?.[30]?.playerGeneralService?.playerQuestService;
    }

    function getCurrentQuestData() {
        return getQuestData()?.currentQuest?.[0];
    }

    // Currently only works for monster kill quests
    function getTimeRemainingToCompleteCurrentQuest(includeSeconds = true) {
        const currentQuestData = getCurrentQuestData();
        if (currentQuestData?.objectiveType === "kills") {
            const killsRemaining = currentQuestData.objectiveAmount - currentQuestData.currentProgress;

            if (getActionsData()?.currentSkill === "battling") {
                return getTimeRemainingToComplete(killsRemaining, includeSeconds);
            }
        }

        return null;
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

    let lastPage = null;
    let lastInactiveQuestNotify = 0;

    const mainObserver = new MutationObserver((mutations, obs) => {
        if (!initialized) { return; }

        // Consider Adding a throttle/batch for this for instances when there are a shitton of mutations at once
        console.log("Mutation observed");
        let toolbarTextWasSet = false;

        const currentPage = getViewedPage();
        const questActive = isQuestActive();
        const currentTab = getViewedTab();

        // Consider running this separately from observer so that it doesn't depend on a mutation in order 
        // to fire
        if (!questActive) {
            const now = Date.now();
            
            // Don't spam notifications in case there are a lot of mutations that trigger this
            if (now - lastInactiveQuestNotify > 10e3) {
                notify("Inactive Queslar quest!")
                lastInactiveQuestNotify = now;
            }
        }

        // If we switch to the "Actions" page, add shortcut buttons to switch between Gear Sets 1 and 2.
        // This makes it easier to do the action set swapping. This is necessary every time we switch to the 
        // Actions page because the gamecontent HTML changes when switching pages (clearingg out 
        // and previously added buttons)
        if (currentPage === "actions" && lastPage !== "actions") {
            let buttonToCopy = getFirstChildElementFromGameContentMenu();
            if (buttonToCopy == null) {
                console.error("Cant find button to copy");
                return;
            }

            let eqGearSet1Button = buttonToCopy.cloneNode();
            eqGearSet1Button.innerText = 'Eq Gear Set 1';
            eqGearSet1Button.onclick = () => equipGearSet(1);

            let eqGearSet2Button = buttonToCopy.cloneNode();
            eqGearSet2Button.innerText = 'Eq Gear Set 2';
            eqGearSet2Button.onclick = () => equipGearSet(2);

            addElementToGameContentMenu(eqGearSet1Button);
            addElementToGameContentMenu(eqGearSet2Button);
        }

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
            addToolbarText(`Time to Kill Quest Completion: ${getTimeRemainingToCompleteCurrentQuest(false)}`);
        }

        // This should go last
        lastPage = currentPage;
    });

    mainObserver.observe(gameContentContainer, {
        childList: true,
        attributes: true,
        subtree: true,
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

    chatObserver.observe(chatContainer, {
        childList: true,
        attributes: true,
        subtree: true,
    });

})();