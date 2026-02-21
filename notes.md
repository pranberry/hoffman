- running a lot of commands. i am completely unfamiliar with the commands.
  - i like that it asks me to confirm which commands it wants me to run.
  - do i trust this whole thing?
  - you can toggle a setting to keep it running
  
- deffs can't one shot. even with opus4.6

## ToDo

- when the overall window size is shrunk, it shouldn't cause UI disruptions and overlapped panels. things should intelligently shrink or disappear. i will provide order and how UI appearance will alter:
  - stock panel should be first to shrink, but not vanish completely. it should collapse into a smaller panel which only has the ticker symbol, the current price and increase/decrease in amount. clicking it should toggle between showing percent in increase or decrease.
  - when the stock panel is at its minimum, and only then, clicking the ticker symbol should display a popover with the info. it should be non-modal, disappearing when i click away. I want the bubble to be anchored to the button that triggered it. It should have a 'beak' or arrow pointing back to the click source. Clicking outside the bubble, or pressing esc, should automatically close it. Don't use a backdrop/scrim; I want the rest of the UI to remain fully visible and interactive. The popover should detect the edge of the app window and flip its orientation (e.g., top-to-bottom) to stay fully visible.
  - panel size should dictate behavior. even if i shrunk the ticker panel when the screen was maximized, it should still behave as outlined above.
  - at present, the stock panel resizing is behaving oddly. pulling the panel shrinks it, pushing increases. it should be reversed.
- need to generate a button graphic for this app

- install .dmg behavior is odd. deleting it from applications doesn't remove it
- stocks panel/tab for greater detail
- - there needs to be a central location for feeds and file store
  - right now, if I install the .dmg the feed is gone, but when i build using `npm run dev` the feeds an stocks are there.