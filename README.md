# GitVis3D

GitVis3D is a visualization tool for git communities.
This is a branch of [CypherVis3D](https://github.com/kofujimura/cypherVis3D).

## Demo movie
to be supplied.

## Live demo
to be supplied.

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

clone a git repository which you want to be visualized.
   ```bash
   git clone ...
   ```

create a git commit log file:
   ```bash
   git log --stat --date=iso -1000 > log.txt
   ```
   
create csv files using the script below. Note that the input file name must be "log.txt".
   ```bash
   pyhton3 gitlogConvertToNeo4jData.py
   ```

move the created following files to the neo4j import folder.
  - author_file_relation.csv
  - author_node.csv
  - file_file_relation.csv
  - file_node.csv

start neo4j:
   ```bash
   sudo neo4j start
   ```

import them to the neo4j:
   ```
   LOAD CSV WITH HEADERS FROM "file:///author_node.csv" AS csvLine CREATE (n: Author {authorId: toInt(csvLine.author_id), authorName: csvLine.author_name, authorMail:csvLine.author_mail } )

   LOAD CSV WITH HEADERS FROM "file:///file_node.csv" AS csvLine CREATE (n: File {fileId: toInt(csvLine.file_id), fileName: csvLine.file_name, fileUpdateDate:csvLine.file_update_date } )

   LOAD CSV WITH HEADERS FROM "file:///file_file_relation.csv" AS csvLine MATCH (m:File), (n:File) WHERE m.fileId = toInt(csvLine.old_file_id) AND n.fileId = toInt(csvLine.new_file_id) CREATE  (m)-[r:UPDATE]->(n)

   LOAD CSV WITH HEADERS FROM "file:///author_file_relation.csv" AS csvLine MATCH (m:Author), (n:File) WHERE m.authorId = toInt(csvLine.author_id) AND n.fileId = toInt(csvLine.file_id) CREATE (m)-[r:CONTRIBUTION]->(n)
   ```

2. Start web server

set password to access Neo4j via http://localhost:7474 and edit cypherVis3DWebServer8080.js to set the password.

start nodejs web server:
   ```bash
   $ node cypherVis3DWebServer8080.js
   ```
   
3. Access http://localhost:8080/gitVis3D.html

4. Run (input Cypher Query)

## Licence

Copyright (c) 2017 Ko Fujimura, Released under the MIT license.
HTML and JavaScript source, cypherVis3D.html and cypherVis3DWebServer8080.js are MIT Licence.

Note that 3D models, ./models/Baynes and ./models/elexis (https://free3d.com/user/3dregenerator) are not part of this project. These models are examples and must be used for only personal use.
