UI/UX Extension for the web game Queslar. This script does not automate gameplay in any way.

Made by Ender

This extension may impact the game's performance, but from personal testing there have not been any significant issues

This entire script is very brittle and can break if Blah changes the naming/styling of the UI

Feel free to suggest/request any features or submit your own PR for changes

# Features:
* Added tab buttons for quickly switching between Gear sets 1 and 2 (for quick action set swapping)
* Notification for inactive quest (since the in game one doesnt seem to work). This is only reliable on when youre 
  on an actions page unfortunately. 
* Displays time needed to complete monster kill and action quests (currently does not work for gold quests)
* Displays time until fatigue
* Notifications when you have unread whispers or system messages

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