"use strict";

var express = require('express');
var router = express.Router();
var GitHub = require('github-api');
var neo4j = require('neo4j-driver');

router.post('/', function (req, res, next) {
    function createGitHub(name, pass) {
        return new GitHub({
            // username: name,
            // password: pass
            token: '8e7b204e0e35148469e5dd7330290c3fcbf6f5d9' // This is a dummy token use your own!
        });
    }
    var gh = createGitHub(req.body.name, req.body.pass);
    var commitLimit = parseInt(req.body.commitlimit);
    var accessLimit = parseInt(req.body.accesslimit);
    var depthLimit = parseInt(req.body.depthlimit);
    var pgName = req.body.project.split('/');
    var projectName = req.body.project;
    console.log('project:' + pgName[0] + '/' + pgName[1]);
    console.log('commitLimit:' + commitLimit);
    console.log('accessLimit:' + accessLimit);
    console.log('depthLimit:' + depthLimit);
    var repo = gh.getRepo(pgName[0], pgName[1]);
    var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "123")); // to be specified in your environment.

    var getCommitData = function (commitLimit) {
        return new Promise(function (resolve, reject) {
            var options = { sha: "" };
            function loop(cnt, retList) {
                repo.listCommits(options).then(function (res) {
                    var data = res.data;
                    var start; // fujimura
                    if (cnt == 0) {start = 0;} else {start = 1;}
                    for (var i = start; i < data.length; i++) {
                        var obj = {};
                        obj.name = data[i].commit.author.name;
                        obj.email = data[i].commit.author.email;
                        // obj.date = data[i].commit.author.date;
                        obj.date = data[i].commit.committer.date;
                        obj.treeSha = data[i].commit.tree.sha;
                        obj.treeUrl = data[i].commit.tree.url;
                        retList.push(obj);
                        cnt++;
                    }
                    options.sha = data[data.length - 1].sha;

                    if (cnt > commitLimit) {
                        resolve(retList);
                    } else {
                        loop(cnt, retList);
                    }
                }, function (error) {
                    reject('list commits:' + error);
                });
            }
            var retList = [];
            loop(0, retList);
        });
    };

    function choiceCommitList(commitList) {
        return new Promise(function (resolve, reject) {
            var retList = [];
            var session = driver.session();
            var query = 'MATCH (m:File) WHERE m.projectName = $projectName return m ORDER BY m.fileUpdateDate DESC limit 10;';
            session.run(query, {
                projectName: projectName
            }).then(function (result) {
                session.close();
                if (result.records.length > 0) {
                    for (var i = 0; i < commitList.length; i++) {
                        var commitDate = new Date(commitList[i].date);
                        var fileDate = new Date(result.records[0].get(0).properties.fileUpdateDate);
                        if (commitDate.getTime() > fileDate.getTime()) {
                            retList.push(commitList[i]);
                        }
                    }
                } else {
                    retList = commitList;
                }
                resolve(retList);
            }).catch(function (err) {
                reject("choiceCommitList:" + err);
            });
        });
    }

    function sortDescCommitList(commitList) {
        return new Promise(function (resolve, reject) {
            var retList = [];
            for (var i = commitList.length - 1; i >= 0; i--) {
                retList.push(commitList[i]);
            }
            for (var i = 0; i < retList.length; i++) {
                console.log(i + ':date:' + retList[i].date);
            }
            resolve(retList);
        });
    }

    var errorProcedure = function (error) {
        console.log("api access error" + error);
        res.json('api access error');
        return;
    };

    class TreeNode {
        constructor() {
            this.path = '';
            this.next = [];
            this.type = '';
            this.depth;
        }
        setPath(path) {
            this.path = path;
        }
        setType(type) {
            this.type = type;
        }
        addNext(a) {
            this.next.push(a);
        }
        setDepth(depth) {
            this.depth = depth;
        }
        getPath() {
            return this.path;
        }
        getNext() {
            return this.next;
        }
        getType() {
            return this.type;
        }
        getDepth() {
            return this.depth;
        }
    }

    //return true if a file tree is completed 
    function isTreeFinish(nnn) {
        return isTreeFinishDepth(nnn, 0);
    }

    //maxDepth is a max-depth of a file tree.
    function isTreeFinishDepth(nnn, maxDepth) {
        var continueList = [];

        function treeSousa(node) {
            if (maxDepth == 0) {
                if (node.getNext().length == 0 && node.getType() == 'tree') {
                    continueList.push(false);
                }
            } else {
                if (node.getNext().length == 0 && node.getType() == 'tree' && node.getDepth() < maxDepth) {
                    continueList.push(false);
                }
            }
            for (var i = 0; i < node.getNext().length; i++) {
                treeSousa(node.getNext()[i]);
            }
        }
        treeSousa(nnn);
        for (var i = 0; i < continueList.length; i++) {
            if (continueList[i] == false) {
                return false;
            }
        }
        return true;
    }

    var treeNode = [];
    var getFilesOfSingleCommit = function (sha, maxDepth) {
        return new Promise(function (resolve, reject) {
            function accessTree(path, sha, oldTreeNum, depth) {
                repo.getTree(sha).then(function (res) {
                    depth++;
                    var data = res.data;
                    for (var i = 0; i < data.tree.length; i++) {
                        treeCnt++;
                        treeNode.push(new TreeNode());
                        treeNode[treeCnt].setPath(path + '/' + data.tree[i].path);
                        treeNode[treeCnt].setType(data.tree[i].type);
                        treeNode[oldTreeNum].addNext(treeNode[treeCnt]);
                        treeNode[treeCnt].setDepth(depth);
                        if (data.tree[i].type == 'blob') {
                            fileList.push(path + '/' + data.tree[i].path);
                        }
                        if (accessCnt >= accessLimit) {
                            resolve(fileList);
                        } else if (data.tree[i].type == 'tree' && depth < maxDepth ) {
                            accessCnt++;
                            accessTree(path + '/' + data.tree[i].path, data.tree[i].sha, treeCnt, depth);
                        }
                    }
                    if (isTreeFinish(treeNode[0]) || isTreeFinishDepth(treeNode[0], maxDepth)) {
                        resolve(fileList);
                    }
                }, function (error) {
                    reject("getFilesOfSingleCommit:" + error);
                });
            }
            var accessCnt = 1;
            var fileList = [];
            var treeCnt = 0;
            var path = "";
            treeNode.push(new TreeNode());
            treeNode[treeCnt].setPath(path);
            treeNode[treeCnt].setType("tree");
            treeNode[treeCnt].setDepth(0);
            accessTree(path, sha, treeCnt, 0);
        });
    };
    
    var getFilesOfCommitList = function (commitList) {
        return new Promise(function (resolve, reject) {
            function loop() {
                var sha = commitList[cnt].treeSha;
                console.log("search tree sha:" + sha);
                getFilesOfSingleCommit(sha, depthLimit).then(function (fileList) {
                    commitList[cnt].fileList = fileList;
                    cnt++;
                    if (cnt == commitList.length) {
                        resolve(commitList);
                    } else {
                        loop();
                    }
                }, function (error) {
                    reject('getFilesOfCommitList:' + error);
                });
            }
            var cnt = 0;
            if (commitList.length == 0) {
                resolve(commitList);
            } else {
                loop();
            }
        });
    };

    function dbGetAuthor(param) {
        return new Promise(function (resolve, reject) {
            var query = 'MATCH (a:Author) WHERE a.authorMail = $email and a.projectName = $projectName return a;';
            var queryParam = {};
            queryParam.projectName = param.projectName;
            queryParam.email = param.email;
            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject('dbGetAuthor' + err);
            });
        });
    }

    function getAuthor(singleCommit) {
        return new Promise(function (resolve, reject) {
            var param = {};
            param.projectName = projectName;
            param.email = singleCommit.email;
            dbGetAuthor(param).then(function (result) {
                if (result.records.length > 0) {
                    singleCommit.authorId = result.records[0].get(0).identity.toInt();
                } else {
                    singleCommit.authorId = -1;
                }
                resolve(singleCommit);
            }).catch(function (err) {
                reject("getAuthor:" + err);
            });
        });
    }

    function dbCreateAuthor(param) {
        return new Promise(function (resolve, reject) {
            var query = 'CREATE (a:Author{authorName: $authorName, authorMail: $authorMail, projectName: $projectName}) return a;';
            var queryParam = {};
            queryParam.projectName = param.projectName;
            queryParam.authorMail = param.authorMail;
            queryParam.authorName = param.authorName;
            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject('dbCreateAuthor:' + err);
            });
        });
    }

    function createAuthor(singleCommit) {
        return new Promise(function (resolve, reject) {
            if (singleCommit.authorId === -1) {
                var param = {};
                param.projectName = projectName;
                param.authorMail = singleCommit.email;
                param.authorName = singleCommit.name;
                dbCreateAuthor(param).then(function (result) {
                    singleCommit.authorId = result.records[0].get(0).identity.toInt();
                    resolve(singleCommit);
                }).catch(function (err) {
                    reject('createAuthor' + err);
                });
            } else {
                resolve(singleCommit);
            }
        });
    }

    function authorInsert(singleCommit) {
        return new Promise(function (resolve, reject) {
            getAuthor(singleCommit).then(createAuthor).then(function (result) {
                resolve(result);
            }).catch(function (err) {
                reject('authorInsert' + err);
            });
        });
    }

    function dbSetAuthorId(param) {
        return new Promise(function (resolve, reject) {
            var query = 'MATCH (n:Author) WHERE ID(n) = $id set n.authorId = $authorId return n;';
            var queryParam = {};
            queryParam.id = neo4j.int(param.authorId);
            queryParam.authorId = String(param.authorId);
            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject('dbSetAuthorId:' + err);
            });
        });
    }

    function setAuthorId(singleCommit) {
        return new Promise(function (resolve, reject) {
            var param = {};
            param.authorId = singleCommit.authorId;
            dbSetAuthorId(param).then(function (result) {
                resolve(singleCommit);
            }).catch(function (err) {
                reject('setAuthorId' + err);
            });
        });
    }

    function dataInsertFirst(commitList) {
        return new Promise(function (resolve, reject) {
            function loop() {
                console.log("dataInsertFirst num:" + i + ',date:' + commitList[i].date);
                authorInsert(commitList[i]).then(setAuthorId).then(function (singleCommit) {
                    retList.push(singleCommit);
                    i++;
                    if (i < commitList.length) {
                        loop();
                    } else {
                        resolve(retList);
                    }
                }).catch(function (err) {
                    reject('dataInsertFirst:' + err);
                });
            }
            var i = 0;
            var retList = [];
            if (commitList.length == 0) {
                resolve(commitList);
            } else {
                loop();
            }
        });
    }

    function searchFile(inParam) {
        return new Promise(function (resolve, reject) {
            var query = 'MATCH (n:File) WHERE n.projectName = $projectName and n.fileName = $fileName return n ORDER BY n.version DESC limit 10;';
            // var query = 'MATCH (n:File) WHERE n.projectName = $projectName and n.fileName = $fileName return n ORDER BY n.fileUpdateDate DESC limit 10;';
            var param = {};
            param.projectName = projectName;
            param.fileName = inParam.fileName;
            var session = driver.session();
            session.run(query, param).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject('searchFile:' + err);
            });
        });
    }

    function createFile(param) {
        return new Promise(function (resolve, reject) {
            var query = 'CREATE (n:File{ lastName: $lastName,fileName: $fileName, fileUpdateDate: $fileUpdateDate, projectName: $projectName, version: $version, dir1: $dir1, dir2: $dir2, dir3: $dir3, dir4: $dir4, dir5: $dir5, type: $type}) return n;';
            var queryParam = {};
            queryParam.fileName = param.fileName;
            queryParam.lastName = param.lastName;
            queryParam.fileUpdateDate = param.date;
            queryParam.version = neo4j.int(param.version);
            queryParam.projectName = projectName;
            queryParam.type = '.' + param.type;
            queryParam.dir1 = param.dir1;
            queryParam.dir2 = param.dir2;
            queryParam.dir3 = param.dir3;
            queryParam.dir4 = param.dir4;
            queryParam.dir5 = param.dir5;
            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                param.nextFileId = result.records[0].get(0).identity.toInt();
                resolve(param);
            }).catch(function (err) {
                reject('createFile:' + err);
            });
        });
    }

    function setDirectories(param) {
        return new Promise(function (resolve, reject) {
            var fileName = param.fileName;
            var dirlist = fileName.split('/');
            param.dir1 = '';
            param.dir2 = '';
            param.dir3 = '';
            param.dir4 = '';
            param.dir5 = '';
            if (dirlist.length > 1 && dirlist.length !== 2) param.dir1 = dirlist[1] + '/';
            if (dirlist.length > 2 && dirlist.length !== 3) param.dir2 = dirlist[2] + '/';
            if (dirlist.length > 3 && dirlist.length !== 4) param.dir3 = dirlist[3] + '/';
            if (dirlist.length > 4 && dirlist.length !== 5) param.dir4 = dirlist[4] + '/';
            if (dirlist.length > 5 && dirlist.length !== 6) {
                var str = '';
                for (var i = 5; i < dirlist.length - 1; i++) {
                    str += dirlist[i] + '/';
                }
                param.dir5 = str;
            }
            param.lastName = dirlist[dirlist.length - 1];
            var typeList = param.lastName.split('.');
            param.type = typeList[typeList.length - 1];
            resolve(param);
        });
    }

    function dbFileRelateAuthor(param) {
        return new Promise(function (resolve, reject) {
            var query = 'MATCH (n1:Author), (n2:File) WHERE ID(n1) = $authorId and ID(n2) = $fileId MERGE (n1)-[:CONTRIBUTION]->(n2);';
            var queryParam = {};
            queryParam.authorId = neo4j.int(param.authorId);
            queryParam.fileId = neo4j.int(param.nextFileId);

            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    function fileRelateAuthor(param) {
        return new Promise(function (resolve, reject) {
            dbFileRelateAuthor(param).then(function (result) {
                resolve(param);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    function dbFileRelateFile(param) {
        return new Promise(function (resolve, reject) {
            var query = 'MATCH (n1:File), (n2:File) WHERE ID(n1) = $fileId1 and ID(n2) = $fileId2 MERGE (n1)-[:UPDATE]->(n2) ;';
            var queryParam = {};
            queryParam.fileId1 = neo4j.int(param.oldFileId);
            queryParam.fileId2 = neo4j.int(param.nextFileId);
            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    function fileRelateFile(param) {
        return new Promise(function (resolve, reject) {
            if (param.oldFileId != -1) {
                dbFileRelateFile(param).then(function (reslt) {
                    resolve(param);
                }).catch(function (err) {
                    reject(err);
                });
            }
            resolve(param);
        });
    }

    function dbSetFileId(param) {
        return new Promise(function (resolve, reject) {
            var query = 'MATCH (n:File) WHERE ID(n) = $id set n.fileId = $fileId return n;';
            var queryParam = {};
            queryParam.id = neo4j.int(param.nextFileId);
            queryParam.fileId = String(param.nextFileId);
            var session = driver.session();
            session.run(query, queryParam).then(function (result) {
                session.close();
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });

        });
    }

    function setFileId(param) {
        return new Promise(function (resolve, reject) {
            dbSetFileId(param).then(function (result) {
                resolve(param);
            }).catch(function (err) {
                reject('setFileid:' + err);
            });
        });
    }

    function getFileId(param) {
        return new Promise(function (resolve, reject) {
            searchFile(param).then(function (result) {
                if (result.records.length > 0) {
                    param.version = parseInt(result.records[0].get(0).properties.version) + 1;
                    param.oldFileId = result.records[0].get(0).identity.toInt();

                } else {
                    param.version = 1;
                    param.oldFileId = -1;
                }
                setDirectories(param).then(createFile).then(setFileId).then(function (param) {
                    resolve(param);
                }).catch(function (err) {
                    reject('getFileId' + err);
                });
            });
        });
    }

    function fileInsert(param) {
        return new Promise(function (resolve, reject) {
            //ファイル更新日を取得して、最新でなかったら、データ挿入を取りやめる。（resolve(param)する）
            //それで駄目だったら、処理の順序がくるっているので、トランザクションを入れる。（そもそもこの時点で謎だけど）
            searchFile(param).then(function (result) {
                if (result.records.length > 0 && new Date(param.date).getTime() < new Date(result.records[0].get(0).properties.fileUpdateDate).getTime()) {
                    console.log(param.fileName + ', paramDate:' + param.date + ',fileUpdateDate:' + result.records[0].get(0).properties.fileUpdateDate);
                    return resolve(param);
                } else {
                    getFileId(param).then(fileRelateAuthor).then(fileRelateFile).then(function (param) {
                        resolve(param);
                    });
                }
            });
        });
    }

    function fileInsertProcedure(singleCommit) {
        return new Promise(function (resolve, reject) {
            function loop() {
                var param = {};
                param.authorId = singleCommit.authorId;
                param.date = singleCommit.date;
                param.fileName = singleCommit.fileList[i];
                fileInsert(param).then(function (result) {
                    i++;
                    retObj.fileList.push(result);
                    if (i < singleCommit.fileList.length) {
                        loop();
                    } else {
                        resolve(retObj);
                    }
                });
            }
            var i = 0;
            var retObj = {};
            retObj.fileList = [];
            loop();
        });
    }

    function dataInsertSecond(commitList) {
        return new Promise(function (resolve, reject) {
            function loop() {
                console.log("data insert second num:" + i + ', date:' + commitList[i].date);
                fileInsertProcedure(commitList[i]).then(function (singleCommit) {
                    retList.push(singleCommit);
                    i++;
                    if (i < commitList.length) {
                        loop();
                    } else {
                        resolve(retList);
                    }
                });
            }
            var i = 0;
            var retList = [];
            if (commitList.length == 0) {
                resolve(commitList);
            } else {
                loop();
            }
        });
    }

    var outData = function (retList) {
        return new Promise(function (resolve, reject) {
            gh.getRateLimit().getRateLimit().then(function (resp) {
                var showData = {};
                showData.list = retList;
                showData.accessRemaining = resp.data.rate.remaining;
                showData.resetDate = new Date(resp.data.rate.reset * 1000);
                res.json(showData);
                console.log('out data');
                resolve(retList);
            }).catch(function (error) {
                reject(error);
            });
        });
    };

    var finishProcess = function () {
        console.log('------finish-----');
        return;
    };

    getCommitData(commitLimit).then(choiceCommitList).then(sortDescCommitList).then(getFilesOfCommitList).then(outData).then(dataInsertFirst).then(dataInsertSecond).then(finishProcess).catch(errorProcedure);
    driver.close();
});

module.exports = router;