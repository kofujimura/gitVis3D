# -*- coding: utf-8 -*-
"""
Created on Mon Mar 20 16:49:49 2017

@author: akira kuriyama
"""

import re
import datetime

def remove_duplicates(x):
    y=[]
    for i in x:
        if i not in y:
            y.append(i)
    return y

def getWordLineNum(first,lines,searchPattern):
    for i in range(first, len(lines)):
        if searchPattern.match(lines[i]):
            return i
    return -1

def hasWordLine(first,lines,searchPattern):
    if getWordLineNum(first,lines,searchPattern) == -1:
        return False
    else:
        return True

def getWordLineNumList(first, inList, searchPattern):
    result = []
    i = first
    while i < len(inList):
        getNum = getWordLineNum(i,inList,searchPattern)
        if getNum != -1:
            result.append(getNum)
            i = getNum + 1
        else:
            break
    return result

def getAuthorInfoDicList(inFile):

    ld = open(inFile, 'r')
    lines = ld.readlines()
    ld.close()

    authLines = []
    pattern = r"^Author"
    repatter = re.compile(pattern)
    for line in lines:
        if repatter.match(line):
            authLines.append(line)
    authLines = remove_duplicates(authLines)

    authorInfoDicList = []
    i= 0
    for line in authLines:
        dic = {}

        i = i + 1
        dic['a_id'] = i

        #name starts at eighth word and end at just befor '<'
        num = line.find('<')
        dic['name']=(line[8 : num-1])

        #main is surrounded by '<' and '>'
        end = line.find('>')
        dic['mail']=(line[num + 1 : end])

        authorInfoDicList.append(dic)

    outFileName = 'author_node.csv'
    print("output file:"+outFileName)
    w = open(outFileName, 'w')
    w.write('author_id' + ',' + 'author_name' + ',' + 'author_mail' + '\n')
    for dic in authorInfoDicList:
        w.write(str(dic['a_id']) + ',' + dic['name'] + ',' + dic['mail'] + '\n')
    w.close()

    return authorInfoDicList


def getCommitInfoDicList(inFile):

    def getCommitLineNum(first,lines):
        searchPattern = re.compile(r"^commit")
        return getWordLineNum(first,lines,searchPattern)

    def hasCommitLine(first,lines):
        searchPattern = re.compile(r"^commit")
        return hasWordLine(first,lines,searchPattern)

    def getAuthLineNum(lines):
        searchPattern = re.compile(r"^Author")
        return getWordLineNum(0,lines,searchPattern)

    def getDateLineNum(lines):
        searchPattern = re.compile(r"^Date:")
        return getWordLineNum(0,lines,searchPattern)

    def getCommitInfoDic(inList):
        commitInfoDic = {}

        authLine = inList[getAuthLineNum(inList)]

        #name starts at eighth word and end at just befor '<'
        num = authLine.find('<')
        commitInfoDic['name']=(authLine[8:num-1])
        
        #main is surrounded by '<' and '>'
        end = authLine.find('>')
        commitInfoDic['mail']=(authLine[num+1:end])

        dateLine = inList[getDateLineNum(inList)]

        #cut time zone info(ex: -0700, +0300).
        dateText = dateLine[8:len(dateLine)-7]
        commitInfoDic['date'] = datetime.datetime.strptime(dateText, '%Y-%m-%d %H:%M:%S')

        #get .htmlfile and .js file
        searchPattern = r"^\s{1}\S+((\.html\s)|(\.js\s))"
        #below line is a sample for getting other file
        #searchPattern = r"^\s{1}\S+((\.html\s)|(\.js\s)|(\.json\s))"
        repatter = re.compile(searchPattern)
        sorceLineNumList = getWordLineNumList(0,inList, repatter)

        srcList =[]
        for srcLineNum in sorceLineNumList:
            line = inList[srcLineNum]
            matchObj = repatter.search(line)
            src = line[1: matchObj.end() - 1]
            srcList.append(src)
            
        commitInfoDic['srcList'] = srcList
            
        return commitInfoDic

    ld = open(inFile, 'r')
    lines = ld.readlines()
    ld.close()

    commitInfoDicList = []
    num = 0
    while num < len(lines):
        commitStartLine = getCommitLineNum(num,lines)
        if hasCommitLine(commitStartLine+1, lines):
            commitFinishLine = getCommitLineNum(commitStartLine + 1, lines) -1
        else:
            commitFinishLine = len(lines) - 1

        searchList = lines[commitStartLine : commitFinishLine + 1]
        commitInfoDic = getCommitInfoDic(searchList)
        
        # add the data which has souce info
        if len(commitInfoDic['srcList']) > 0:
            commitInfoDicList.append(commitInfoDic)

        num = commitFinishLine +1

    return commitInfoDicList

    
def getSrcUpdateInfoDicList(commitInfoDicList, authorInfoDicList):

    def getUniqueSrclist():        
        fileList = []
        for commitDic in commitInfoDicList:
            for src in commitDic['srcList']:
                fileList.append(src)
        return remove_duplicates(fileList)
        
    def getAuthorId(mail):
        for authorDic in authorInfoDicList:
            if re.fullmatch(mail, authorDic['mail']):
                return authorDic['a_id']
        return None

    uniqueSrcList = getUniqueSrclist()
    
    #return list
    srcUpdateInfoDicList = []
    
    for src in  uniqueSrcList:
        dic = {}
        dic['src'] = src        
        srcUpdateInfoDicList.append(dic)

    for srcUpdateInfoDic in srcUpdateInfoDicList:
        updateInfoDicList = []
        for commitInfoDic in commitInfoDicList:
            for src in commitInfoDic['srcList']:
                if srcUpdateInfoDic['src'] == src:
                    dic = {}
                    dic['mail'] = commitInfoDic['mail']
                    dic['date'] = commitInfoDic['date']
                    updateInfoDicList.append(dic)
                    
        srcUpdateInfoDic['updateInfoDicList'] = sorted(updateInfoDicList, key = lambda x : x['date'])
        
    for srcUpdateInfoDic in srcUpdateInfoDicList:
        for updateInfoDic in srcUpdateInfoDic['updateInfoDicList']:
            mail = updateInfoDic['mail']
            updateInfoDic['a_id'] = getAuthorId(mail)
                
    #file id is unique
    num = 0
    for srcUpdateInfoDic in srcUpdateInfoDicList:
        for updateInfoDic in srcUpdateInfoDic['updateInfoDicList']:
            num = num + 1
            updateInfoDic['file_id'] = num

    for srcUpdateInfoDic in srcUpdateInfoDicList:
        version = 1
        for updateInfoDic in srcUpdateInfoDic['updateInfoDicList']:
            updateInfoDic['file_version'] = version
            updateInfoDic['file_name'] = srcUpdateInfoDic['src'] + '_' + str(updateInfoDic['file_version'])
            version = version + 1

    for srcUpdateInfoDic in srcUpdateInfoDicList:
        i = 0
        while i < len(srcUpdateInfoDic['updateInfoDicList']) - 1:
            srcUpdateInfoDic['updateInfoDicList'][i]['next_file_id'] = srcUpdateInfoDic['updateInfoDicList'][i + 1]['file_id'] 
            i = i +1
        srcUpdateInfoDic['updateInfoDicList'][i]['next_file_id'] = None
        #same to below
        #srcUpdateInfoDic['updateInfoDicList'][len(srcUpdateInfoDic['updateInfoDicList']) - 1]['next_file_id'] = None
    
    return srcUpdateInfoDicList


def outNeo4jData(srcUpdateInfoDicList):
    outFileName1 = 'file_node.csv'
    print("output file:"+outFileName1)
    w = open(outFileName1, 'w')
    w.write('file_id,file_name,file_update_date\n')
    for srcUpdateInfoDic in srcUpdateInfoDicList:
        for updateInfoDic in srcUpdateInfoDic['updateInfoDicList']:
            w.write(str(updateInfoDic['file_id']))
            w.write(",")
            w.write(updateInfoDic['file_name'])
            w.write(",")
            w.write(updateInfoDic['date'].strftime('%Y-%m-%d %H:%M:%S'))
            w.write("\n")
    w.close()
    
    outFileName2 = 'file_file_relation.csv'
    print("output file:"+outFileName2)
    w = open(outFileName2, 'w')
    w.write('old_file_id,new_file_id\n')
    for srcUpdateInfoDic in srcUpdateInfoDicList:
        i = 0
        while srcUpdateInfoDic['updateInfoDicList'][i]['next_file_id'] != None:
            w.write(str(srcUpdateInfoDic['updateInfoDicList'][i]['file_id']))
            w.write(",")            
            w.write(str(srcUpdateInfoDic['updateInfoDicList'][i]['next_file_id']))
            w.write("\n")
            i = i + 1
    w.close()

    outFileName3 = 'author_file_relation.csv'
    print("output file:"+outFileName3)
    w = open(outFileName3, 'w')
    w.write('author_id,file_id\n')
    for srcUpdateInfoDic in srcUpdateInfoDicList:
        for updateInfoDic in srcUpdateInfoDic['updateInfoDicList']:
            w.write(str(updateInfoDic['a_id']))
            w.write(",")
            w.write(str(updateInfoDic['file_id']))
            w.write("\n")        
    w.close()
    
    return


#inputFileName = 'three1000_3.log'#small data
#inputFileName = 'three1000_1.log'#big data
inputFileName = 'log.txt'

print("---START---")
print("input file:"+inputFileName)
authorInfoDicList = getAuthorInfoDicList(inputFileName)
commitInfoDicList = getCommitInfoDicList(inputFileName)
srcUpdateInfoDicList = getSrcUpdateInfoDicList(commitInfoDicList, authorInfoDicList)
outNeo4jData(srcUpdateInfoDicList)
print("---FINISH---")




