// Geom

var rotateAndTranslate = function(point, angle, tx, ty) {
    var x = point[0];
    var y = point[1];

    var rx = Math.cos(angle) * x - Math.sin(angle) * y;
    var ry = Math.sin(angle) * x + Math.cos(angle) * y;

    x = rx + tx;
    y = ry + ty;

    point[0] = x;
    point[1] = y;
}


var dotProduct = function(p0, p1) {
    return (p0[0] * p1[0]) + (p0[1] * p1[1]);
}


var pointInTriangle = function(A, B, C, P) {
    var v0 = [0, 0];
    var v1 = [0, 0];
    var v2 = [0, 0];
    
    v0[0] = C[0] - A[0];
    v0[1] = C[1] - A[1];
    v1[0] = B[0] - A[0];
    v1[1] = B[1] - A[1];
    v2[0] = P[0] - A[0];
    v2[1] = P[1] - A[1];

    var dot00 = dotProduct(v0, v0);
    var dot01 = dotProduct(v0, v1);
    var dot02 = dotProduct(v0, v2);
    var dot11 = dotProduct(v1, v1);
    var dot12 = dotProduct(v1, v2);

    var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u > 0) && (v > 0) && (u + v < 1);
}


/*
Return the intersection point between the line segment defined by (x1, y1) and (x2, y2)
and a rectangle defined by (rleft, rtop, rright, rbottom)

(x1, y1) is assumed to be inside the rectangle and (x2, y2) outside 
*/
var interRect = function(x1, y1, x2, y2, rleft, rtop, rright, rbottom) {
    var t, tx, ty, edge;
    
    var dx = x2 - x1;
    var dy = y2 - y1;
    
    if ((dx == 0) && (dy == 0)) {
        return 0;
    }

    // Let x = x1 + dx * t  and calculate t at the intersection point with a vertical border.
    if (dx != 0) {
        var edge;
        if (dx > 0) {
            edge = rright;
        }
        else {
            edge = rleft;
        }
        tx = (edge - x1) / dx;
    }

    // Let y = y1 + dy * t and calculate t for the vertical border.
    if (dy != 0) {
        var edge;
        if (dy > 0) {
            edge = rbottom;
        }
        else {
            edge = rtop;
        }
        ty = (edge - y1) / dy;
    }

    // Then take the shorter one.
    if (dx == 0) {
        t = ty;
    }
    else if (dy == 0) {
        t = tx;
    }
    else {
        if (tx < ty) {
            t = tx;
        }
        else {
            t = ty;
        }
    }

    // Calculate the coordinates of the intersection point.
    var ix = x1 + dx * t;
    var iy = y1 + dy * t;
    return [ix, iy];
}