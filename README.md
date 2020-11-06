UI/UX Extension for the web game Queslar. This script does not automate gameplay in any way.

Made by Ender

This extension may impact the game's performance, but from personal testing there have not been any significant issues

This entire script is very brittle and can break if Blah changes the naming/styling of the UI

Feel free to suggest/request any features or submit your own PR for changes

# Features:
* Addes easily accessible buttons for quickly switching between Gear Sets (mainly for quick action set swapping)
* Adds several links for quickly accessing certain pages that my lazy ass has found useful
* Notification for inactive quest (since the in game one doesnt seem to work).
* Displays time needed to complete monster kill and action quests (currently does not work for gold quests)
* Displays time until fatigue
* Notifications when you have unread whispers or system messages
* Deletes Round Information from dungeon fights, making it easier to spam dungeons. 

# Installation

The entire script can be found [here](queslar-ui-ux.user.js).

#### Tampermonkey

Install [Tampermonkey](https://www.tampermonkey.net/) and then open the [raw link](https://github.com/danielyxie/queslar-ui-ux-extension/raw/main/queslar-ui-ux.user.js) to the script in order to install it.

You can also probably do the same thing  with Greasemonkey but I haven't personally tried it out

#### Manually

You can just manually copy and paste the extension, but you'll have to do this everytime you close and re-open the game:

1. Copy [the script](queslar-ui-ux.user.js)
2. Navigate to Queslar and open the DevTools console, which can be done by pressing F12 on most modern browsers
3. Paste the code into the console and press enter to execute it
4. Enter the following command into the console (don't forget to press enter to execute): `dispatchEvent(new Event("DOMContentLoaded"))`
4. Close the DevTools. This is important because Queslar has some weird memory leak issue if DevTools is left open