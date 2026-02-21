- running a lot of commands. i am completely unfamiliar with the commands.
  - i like that it asks me to confirm which commands it wants me to run.
  - do i trust this whole thing?
  - you can toggle a setting to keep it running
  
- deffs can't one shot. even with opus4.6

## ToDo

- add export feed + stocks setting. output a .json file. come up with simple resonable syntax
- add an import setting to import the json with above defined syntax
- when the overall window size is shrunk, it shouldn't cause UI disruptions and overlapped panels. things should intelligently shrink or disappear. i will provide order and how UI appearance will alter:
  - stock panel should be first to shrink, but not vanish completely. it should collapse into a smaller panel which only has the ticker symbol, the current price and increase/decrease in amount. clicking it should show percent in increase or decrease.
  - if the stocks panel is shrunk, clicking the ticker symbol should make the extra info dialog be a popup which hovers over the screen until you escape (click or esc key)
  - panel size should dictate behavior. even if i shrunk the ticker panel when the screen was maximized, it should still behave as outlined above.
  - at present, the stock panel resizing is behaving oddly. pulling the panel shrinks it, pushing increases. it should be reversed.
- need to generate a button graphic for this app
- install .dmg behavior is odd. deleting it from applications doesn't remove it
- stocks panel/tab for greater detail
- - there needs to be a central location for feeds and file store
  - right now, if I install the .dmg the feed is gone, but when i build using `npm run dev` the feeds an stocks are there.