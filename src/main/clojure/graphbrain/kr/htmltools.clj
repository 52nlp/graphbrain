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

(ns graphbrain.kr.htmltools
  (:require [graphbrain.kr.webtools :as webtools]
            [graphbrain.kr.meat :as meat])
  (:import (org.jsoup Jsoup)
           (org.jsoup.nodes TextNode)
           (edu.stanford.nlp.process DocumentPreprocessor)
           (edu.stanford.nlp.ling HasWord)))

(defn- deep-text
  "Extract the text from a html node"
  [node]
  (let [cn  (. node childNode 0)]
    (. cn text)))

(defn- non-white-count
  "Count number of non-whitespace characters in a string"
  [text]
  (loop [rest-text text
         count 0]
    (if (empty? rest-text)
      count
      (if (Character/isWhitespace (first rest-text))
        (recur (rest rest-text) count)
        (recur (rest rest-text) (inc count))))))

(defn- parse-node
  "Parse html node to a list of maps with info about text and certain tags"
  [node char-count]
  (flatten (let [children (. node childNodes)]
    (loop [rest-chil children
           res []
           cc char-count]
      (if (empty? rest-chil)
        res
        (let [n (first rest-chil)
              elem (cond
                (instance? TextNode n) {:text (. n text)}
                (= "a" (. n nodeName)) {:text (deep-text n)
                                        :tag "a"
                                        :href (. n attr "abs:href")}
                (= "strong" (. n nodeName)) {:text (deep-text n), :tag "strong"}
                :else (parse-node n cc))
              length (if (map? elem)
                       (non-white-count (elem :text))
                       (if (empty? elem)
                         0
                         (- ((last elem) :end) cc)))]
          (recur
            (rest rest-chil)
            (conj res (if (map? elem)
                        (merge elem {:start cc, :end (+ cc length)})
                        elem))
            (+ cc length))))))))

(defn- split-text-tags
  "Split output of parse-node into a string with all the text
  and list of maps with information about tags"
  [text+tags]
  (loop [list text+tags
         text ""
         text-parts []
         tags []]
    (if (empty? list)
      {:text text, :text-parts text-parts :tags tags}
      (let [elem (first list)]
        (recur
          (rest list)
          (str text " " (elem :text))
          (conj text-parts (elem :text))
          (if (nil? (elem :tag))
            tags
            (conj tags elem)))))))

(defn- parse-doc
  [doc]
  (parse-node doc 0))

(defn html->text+tags
  [html]
  (split-text-tags (parse-doc (Jsoup/parse html))))

(defn html->jsoup
  [html]
  (Jsoup/parse html))

(defn jsoup->title
  [jsoup]
  (.title jsoup))
