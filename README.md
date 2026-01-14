# mortail-coil-arena

### Installation

#### Dependencies

- Nodejs
- npm
  - express
  - ws
  - cors

#### Setup the Server

```
git clone https://github.com/Inselaffe03/mortail-coil-arena
cd mortal-coil-arena/server && npm install
node mortal-coil.js
```

### API Endpoint:

| Method       |     Endpoint     |                                            Description |
| :----------- | :--------------: | -----------------------------------------------------: |
| GET          |    /api/state    |                               - Get current game state |
| GET          |   /api/levels    |                               - Get list of all levels |
| POST         |  /api/level/:id  |                                - Load a specific level |
| POST         |    /api/start    |                        - Start game at position {x, y} |
| POST         |    /api/move     | - Make a move {direction: up \| down \| left \| right} |
| POST         |    /api/reset    |                                  - Reset current level |

### Agents
In `agents/` are different approaches to solve the mortal-coil levels in various programming languages, due to the
central API that every programm can send data to.

## Upcoming Ideas

- **Duells** two Agents play against each other
    1) the agent wins, who is first to solve the puzzle
    2) the agent wins, who mapped more tiles in a certain time
    3) the agent wins, who solved the puzzle with the least amount of turns