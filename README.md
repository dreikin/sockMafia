[![Dependency Status](https://david-dm.org/yamikuronue/sockMafia/master.svg)](https://david-dm.org/yamikuronue/sockMafia/master)
[![devDependency Status](https://david-dm.org/yamikuronue/sockMafia/master/dev-status.svg)](https://david-dm.org/yamikuronue/sockMafia/master#info=devDependencies)
[![optionalDependency Status](https://david-dm.org/yamikuronue/sockMafia/master/optional-status.svg)](https://david-dm.org/yamikuronue/sockMafia/master#info=optionalDependencies)


#SockBot Mafia

Mafia plugin for [SockBot](https://sockbot.rtfd.org/en/latest/) version 2.10.0 or later.

##Usage

###TODO: Add Usage Information

##Developers

###TODO: Add Developer Dedications

##Installation

The preferred method of installation is via NPM; simply run this command within the SockBot installation folder:
```
npm install sockbot-mafia
```

Other methods of installation are possible e.g. cloning the git repository, but only installation via NPM is supported.

###Post Install Setup

If you installed via NPM skip this step as NPM has already installed all necessary dependencies.
Otherwise you will need to run the following command in the folder where you installed SockBot Mafia:
```
npm install
```

##Configuration

ocumentation about configuration options for the bot!
YAML example:
```
---
core:
  username: username
  password: password
  owner: owner
plugins:
  sockbot-mafia: {}
```

JSON example:
```
{
  "core": {
    "username": "username",
    "password": "password",
    "owner": "owner"
  },
  "plugins": {
    "sockbot-mafia": {}
  }
}
```

Note that these examples assume an NPM-based installation; other installation methods may require the path to `Mafia.js` (without file extension) be specified explicitly.

YAML example:
```
---
core:
  username: username
  password: password
  owner: owner
plugins:
  '../path/to/Mafia': {}
    -
```

JSON example:
```
{
  "core": {
    "username": "username",
    "password": "password",
    "owner": "owner"
  },
  "plugins": {
    "../path/to/Mafia": {}
  }
}
```
