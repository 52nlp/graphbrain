#   Copyright (c) 2016 CNRS - Centre national de la recherche scientifique.
#   All rights reserved.
#
#   Written by Telmo Menezes <telmo@telmomenezes.com>
#
#   This file is part of GraphBrain.
#
#   GraphBrain is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   GraphBrain is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with GraphBrain.  If not, see <http://www.gnu.org/licenses/>.


from __future__ import print_function
from gb.knowledge.semantic_tree import Position


class DeltaStage(object):
    def __init__(self, tree):
        self.rel_pos = ['VERB', 'ADV', 'ADP', 'PART']
        self.tree = tree

    def is_relationship(self, entity_id):
        entity = self.tree.get(entity_id)
        if entity.is_node():
            for child_id in entity.children_ids:
                if not self.is_relationship(child_id):
                    return False
            return True
        else:
            return entity.token.pos in self.rel_pos

    def is_part_of_rel(self, rel, part):
        rel_elems = rel.flat_leafs()
        part_elems = part.flat_leafs()

        for relem in rel_elems:
            for pelem in part_elems:
                if relem == pelem:
                    return True

        return False

    def is_directly_under(self, node, parent, child):
        if node.arity() < 2:
            return False

        rel = self.tree.get(node.children_ids[0])
        if self.is_part_of_rel(rel, parent):
            for i in range(1, len(node.children_ids)):
                elem = self.tree.get(node.children_ids[i])
                if elem == child:
                    return True

        for i in range(1, len(node.children_ids)):
            elem = self.tree.get(node.children_ids[i])
            if self.is_directly_under(elem, parent, child):
                return True

        return False

    def node_fit(self, node, original):
        fit = 0
        if node.is_node() and self.is_relationship(node.children_ids[0]):
            rel = self.tree.get(node.children_ids[0])
            if rel.arity() == 1 and (len(node.children_ids) == 2):
                fit += 1000
            elif rel.arity() == (len(node.children_ids) - 2):
                fit += 1000

            if rel.is_not_terminal():
                count = min(rel.arity(), node.arity() - 2)
                for i in range(count):
                    rel_part = rel.get_child(i)
                    param1 = node.get_child(i + 1)
                    if i == 0:
                        if self.is_directly_under(original, rel_part, param1):
                            fit += 100
                    param2 = node.get_child(i + 2)
                    if self.is_directly_under(original, rel_part, param2):
                        fit += 100

        return fit

    def find_candidates(self, original_node):
        if original_node.is_leaf():
            return [original_node]

        # initialize node, to_process and candidates
        to_process = original_node.children_ids[1:]
        new_node = self.tree.create_node(original_node.children_ids[:1])
        candidates = []
        return self.find_candidates_r(original_node, new_node, to_process, candidates)

    def build_candidate(self, original_node, working_node, rel_id, child, to_process, candidates):
        new_node = working_node.clone()
        new_node.children_ids[0] = rel_id
        new_node.children_ids += child.children_ids[1:]
        self.find_candidates_r(original_node, new_node, to_process[1:], candidates)

    def find_candidates_r(self, original_node, working_node, to_process, candidates):
        if len(to_process) > 0:
            child_id = to_process[0]
            child = self.tree.get(child_id)
            child_candidates = self.find_candidates(child)

            for child in child_candidates:
                if child.is_node() and self.is_relationship(child.children_ids[0]):
                    # generate several possibilities for relationships

                    rel_left = self.tree.get(working_node.children_ids[0])
                    rel_right = self.tree.get(child.children_ids[0])

                    # insert before
                    if len(working_node.children_ids) == 1:
                        rel = self.tree.create_node([working_node.children_ids[0]])
                        rel.children_ids.insert(0, child.children_ids[0])
                        self.build_candidate(original_node, working_node, rel.id, child, to_process, candidates)

                    # make compound
                    if rel_left.is_terminal() and rel_right.is_terminal():
                        if rel_left.is_terminal():
                            rel = rel_left
                        else:
                            rel_id = rel_left.children_ids[-1]
                            rel = self.tree.get(rel_id)
                        rel = rel.clone()
                        if rel.is_terminal():
                            rel = self.tree.create_node([rel.id])
                        rel.add_child(child.children_ids[0])
                        rel.compound = True
                        self.build_candidate(original_node, working_node, rel.id, child, to_process, candidates)

                    # merge at the center
                    if rel_left.is_not_terminal() or rel_right.is_not_terminal():
                        if rel_left.is_terminal():
                            rel_left_a = []
                            rel_left_b = rel_left.id
                        else:
                            rel_left_a = rel_left.children_ids[:-1]
                            rel_left_b = rel_left.children_ids[-1]
                        if rel_right.is_terminal():
                            rel_right_a = rel_right.id
                            rel_right_b = []
                        else:
                            rel_right_a = rel_right.children_ids[0]
                            rel_right_b = rel_right.children_ids[1:]

                        center_rel_node = self.tree.create_node([rel_left_b, rel_right_a])
                        center_rel_node.compound = True

                        rel_ids = rel_left_a + [center_rel_node.id] + rel_right_b
                        rel = self.tree.create_node(rel_ids)

                        self.build_candidate(original_node, working_node, rel.id, child, to_process, candidates)

                    # add to first child
                    if rel_right.is_terminal():
                        new_node = working_node.clone()
                        rel_id = working_node.children_ids[0]
                        rel = self.tree.get(rel_id)
                        if not rel.is_terminal():
                            rel = rel.clone()
                        else:
                            rel = self.tree.create_node([rel.id])
                        new_node.children_ids[0] = rel.id
                        new_node.add_to_first_child(child.children_ids[0], Position.RIGHT)
                        rel_id = new_node.children_ids[0]
                        self.build_candidate(original_node, working_node, rel_id, child, to_process, candidates)
                # else:
                # just append new child
                new_node = working_node.clone()
                new_node.children_ids.append(child_id)
                self.find_candidates_r(original_node, new_node, to_process[1:], candidates)
        else:
            working_node.get_child(0).flatten()
            candidates.append(working_node)

        return candidates

    def process_entity(self, entity_id):
        entity = self.tree.get(entity_id)

        if not entity.is_terminal() and self.is_relationship(entity.children_ids[0]):
            best_node = None
            best_fit = -1
            candidates = self.find_candidates(entity)
            for candidate in candidates:
                fit = self.node_fit(candidate, entity)
                # print('$ %s {%s}' % (candidate, fit))
                if fit > best_fit:
                    best_fit = fit
                    best_node = candidate
            return best_node.id

        return entity_id

    def process(self):
        self.tree.root_id = self.process_entity(self.tree.root_id)
        return self.tree


def transform(tree):
    return DeltaStage(tree).process()
