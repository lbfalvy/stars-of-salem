Users are always on positions. A position is something that determines a person's location,
like a control panel or a wall cabinet.

position - something you're doing (eg. controlTable, fuelMixer, oxidantTank, doorBridgeToLobby)
    space - the space where the position is
    routes - list of positions you can transfer to
    devices - set of devices that need to communicate with FE
    cover - list of positions in this space that you can't see from here
space - a group of positions where people can see each other (eg. bridge, engine, bio)
    positions - all the positions in the space

Game view:
    inventory,
    Position
Position view:
    list of users in position
    if devices:
        compact list of other users in space + their position
        devices
        compact list of routes
    otherwise:
        list of visible positions and routes combined

User view:
    name, volume
    if reachable: can give items from inventory


Devices:
Goals:
    Plugins can introduce new components, static resources, devices and arbitrary classes on the server
    You can reuse devices across rooms and maps
    A client-side device (eg. a dial) can connect to different server-side things
    The whole UI need not be responsive, the layout need not change
Constraints:
    The aspect ratio is fixed, and decided by the server
    devices are constructed on server command, at server-specified positions
    devices have a screen-proportional size
    
Plan:
    Serverside: regular classes with an onViewed method that 
    gets a player and a channel and returns a disposable
    Clientside: react components that get init options from the server + the channel to start

