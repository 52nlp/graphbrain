#!/usr/bin/env python
# -*- coding: utf-8 -*-


import re
from re import findall, DOTALL
import urllib
import urllib2
import sys
from pymongo import Connection
from gb import wikipedia 


def person_id(db, name, wptitle):
    pid = None
    mpeople = db.people
    d = {}
    d['name'] = name
    if len(wptitle) > 0:
        d['wptitle'] = wptitle
    person = mpeople.find_one(d)
    if person is None:
        pid = mpeople.insert(d)
    else:
        pid = person['_id']

    return pid


def process_page(db, wptitle, film):
    print 'Processing: ', wptitle
    wpage = wikipedia.getpage(wptitle)
    sections = wikipedia.page2sections(wpage)

    # process infobox
    properties = {}
    if '' in sections:
        lines = sections[''].split('\n')
        for l in lines:
            l = l.strip()
            if (len(l) > 1) and (l[0] == '|'):
                l = l.strip('|')
                prop = l.split('=')
                if len(prop) > 1:
                    prop[0] = prop[0].strip()
                    prop[1] = prop[1].strip()
                    properties[prop[0]] = prop[1]
    print properties

    # process cast
    if 'cast' in sections:
        print '->Cast'
        lines = sections['cast'].split('\n')
        for l in lines:
            l = l.strip()
            if (len(l) > 1) and (l[0] == '*'):
                l = l.strip('* ')
                role = l.split(' as ')
                text, link = wikipedia.text_and_or_link(role[0])
                print '%s [%s]' % (text, link)
                print person_id(db, text, link)


def main():
    db = Connection().cinema

    mfilms = db.films
    q = mfilms.find()
    for film in q:
        wptitle = film['wptitle']
        process_page(db, wptitle, film)


if __name__=='__main__':
    main()