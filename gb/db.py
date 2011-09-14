import MySQLdb as mdb
from config import *


_conn = None


def _connect():
    global _conn

    # HACK: reopen connection everytime to avoid "MySQL server has gone" errors
    # TODO: solve this properly
    _conn = None

    try:
        if _conn is None:
            _conn = mdb.connect('localhost', DB_USER, DB_PASSWORD, DB_NAME);
    except mdb.Error, e:
        print "Error %d: %s" % (e.args[0],e.args[1])


def cursor():
    global _conn
    _connect()
    return _conn.cursor()
    
    
def connection():
    global _conn
    _connect()
    return _conn


def execute(query):
    global _conn
    _connect()
    cur = cursor()
   
    try:
        cur.execute(query)
        connection().commit()
    except mdb.Error, e:
        print "Error %d: %s" % (e.args[0],e.args[1])
    cur.close()
