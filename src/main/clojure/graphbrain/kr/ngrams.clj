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

(ns graphbrain.kr.ngrams
  (:require [graphbrain.graphs.graphtools :as gt]
            [graphbrain.graphs.pagerank :as pr]
            [graphbrain.kr.wordgraph :as wg]
            [graphbrain.kr.nlptools :as nlp]))


;; build ngrams

(defn- sentence->ngrams
  [twords sentence]
  (loop [wlist sentence
         ngram {:words []}
         ngrams #{}]
    (if (empty? wlist)
      (if (empty? (:words ngram))
        ngrams
        (conj ngrams ngram))
      (let [word (first wlist)]
        (if (contains? twords word)
          (recur (rest wlist)
                 (assoc ngram :words (conj (:words ngram) word))
                 ngrams)
          (recur (rest wlist)
                 {:words []}
                 (if (empty? (:words ngram))
                   ngrams
                   (conj ngrams ngram))))))))

(defn topwords->ngrams
  [twords sentences]
  (loop [slist sentences
         ngrams #{}]
    (if (empty? slist)
      ngrams
      (recur
       (rest slist)
       (clojure.set/union ngrams
                          (sentence->ngrams twords (first slist)))))))

(defn- word-with-pr
  [word graph]
  (let [pr (:pr (graph word))]
    (assoc word :pr pr)))

(defn- words-with-pr
  [words graph]
  (into [] (map #(word-with-pr % graph) words)))

(defn ngrams-with-pr
  [ngrams graph]
  (map #(assoc % :words (words-with-pr (:words %) graph)) ngrams))

(defn- average
  [coll]
  (println (str coll " " (reduce + coll)  " " (count coll)))
  (/ (reduce + coll) (count coll)))

(defn- ngram-score
  [ngram]
  (average (map #(:pr %) (:words ngram))))

(defn scored-ngrams
  [ngrams]
  (map #(assoc % :score (ngram-score %)) ngrams))

(defn sorted-ngrams
  [ngrams]
  (sort-by :score ngrams))

(defn html->ngrams
  [html]
  (let [sentences (nlp/html->sentences html)
        prgraph (wg/words->prgraph (nlp/sentences->words sentences))
        twords (wg/prgraph->topwords prgraph)]
    (sorted-ngrams
     (scored-ngrams
      (ngrams-with-pr (topwords->ngrams twords sentences) prgraph)))))


;; build ngram graph

(defn- ngram->map
  [ngram ngram-map]
  (let [word (first (:words ngram))]
    (assoc ngram-map word (into #{} (conj (ngram-map word) ngram)))))

(defn- ngrams->map
  [ngrams]
  (loop [m {}
         nglist ngrams]
    (if (empty? nglist)
      m
      (recur (ngram->map (first nglist) m) (rest nglist)))))

(defn- is-parent?
  [ngram rest-words parent-words]
  (if (< (count parent-words) (count (:words ngram)))
    (= (take (count parent-words) rest-words) parent-words)))

(defn- add-parents
  [ngram parent-ngrams ngrams words]
  (loop [parents parent-ngrams
         candidates ngrams]
    (if (empty? candidates)
      parents
      (let [candidate (first candidates)]
        (recur (if (is-parent? ngram words (:words candidate))
                 (conj parents candidate)
                 parents)
               (rest candidates))))))

(defn- parent-ngrams
  [ngram ngram-map]
  (let [ngram-words (:words ngram)]
    (loop [ngrams []
           words ngram-words]
      (if (empty? words)
        ngrams
        (recur (add-parents ngram ngrams (ngram-map (first words)) words)
               (rest words))))))

(defn- ngram->graph
  [ngram graph ngram-map]
  (let [parents (parent-ngrams ngram ngram-map)]
    (loop [g graph
           p parents]
      (if (empty? p)
        g
        (recur (gt/add-arc g (list ngram (first p))) (rest p))))))

(defn ngrams->graph
  [ngrams]
  (let [ngram-map (ngrams->map ngrams)]
    (loop [ngs ngrams
           graph {}]
     (if (empty? ngs)
       graph
       (recur (rest ngs) (ngram->graph (first ngs) graph ngram-map))))))

(defn ngram->str
  [ngram]
  (clojure.string/join " " (map #(:word %) (:words ngram))))

(defn leaf-ngrams
  [ngrams-graph]
  (keys (filter #(empty? (:in (second %))) ngrams-graph)))

(defn html->ngrams-graph
  [html]
  (let [ngrams (html->ngrams html)]
    (ngrams->graph ngrams)))
