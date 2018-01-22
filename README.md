# GitVis3D

GitVis3D is a visualization tool for git communities.
This is a branch of [CypherVis3D](https://github.com/kofujimura/cypherVis3D).

## Demo movie
https://www.youtube.com/watch?v=67s8WCEjIx8

## Live demo
http://qa.fujimura.com:8080/gitVis3D.html

## How to install

1. Install [Neo4j](http://neo4j.org)

2. Install [node.js](http://nodejs.org)

3. Install [seraph.js](https://github.com/brikteknologier/seraph)

4. Install [socket.io](http://socket.io/)

5. Install [express.js](https://expressjs.com/)

6. Install [d3.js](https://d3js.org/)

7. Install [three.js](https://threejs.org/)

## How to use

1. Store data into Neo4j.

start nodejs githubAPI server. 

   ```bash
   $ node githubAPIServer3000.js
   ```
get git commit logs from github repository via http://localhost:3000/input.

   
2. Start web server

set password to access Neo4j via http://localhost:7474 and edit cypherVis3DWebServer8080.js to set the password.

start nodejs web server:
   ```bash
   $ node cypherVis3DWebServer8080.js
   ```
   
3. Access http://localhost:8080/gitVis3D.html

4. Run

## Licence

Copyright (c) 2017 Ko Fujimura, Released under the MIT license.
gitVis3D.html, gitVis3D.css, gitlogConvertToNeo4jData.py and cypherVis3DWebServer8080.js are MIT Licence.

Note that 3D models, ./models/Baynes and ./models/elexis (https://free3d.com/user/3dregenerator) are not part of this project. These models are examples and must be used for only personal use.

## Acknowledgment

This work was supported by JSPS KAKENHI Grant Number JP26330348.
