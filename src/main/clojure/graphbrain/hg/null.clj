;   Copyright (c) 2016 CNRS - Centre national de la recherche scientifique.
;   All rights reserved.
;
;   Written by Telmo Menezes <telmo@telmomenezes.com>
;
;   This file is part of GraphBrain.
;
;   GraphBrain is free software: you can redistribute it and/or modify
;   it under the terms of the GNU Affero General Public License as published by
;   the Free Software Foundation, either version 3 of the License, or
;   (at your option) any later version.
;
;   GraphBrain is distributed in the hope that it will be useful,
;   but WITHOUT ANY WARRANTY; without even the implied warranty of
;   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;   GNU Affero General Public License for more details.
;
;   You should have received a copy of the GNU Affero General Public License
;   along with GraphBrain.  If not, see <http://www.gnu.org/licenses/>.

(ns graphbrain.hg.null
  "Implements null hypergraph storage.
   Nothing is written, and queries return nothing.
   Useful for dry runs."
  (:require [graphbrain.hg.ops :as ops]))

(deftype NullOps []
  ops/Ops
  (exists? [hg vertex] false)
  (add!* [hg edge timestamp] edge)
  (remove! [hg edge])
  (pattern->edges [hg pattern] #{})
  (star [hg center] #{})
  (symbols-with-root [hg root] #{})
  (destroy! [hg])
  (degree [hg vertex] 0)
  (timestamp [hg vertex] -1)
  (batch-exec! [hg funs])
  (f-all [hg f]))

(defn connection
  "Obtain a null hypergraph connection."
  []
  (NullOps.))
