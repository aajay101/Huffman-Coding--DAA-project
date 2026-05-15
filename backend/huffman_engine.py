from __future__ import annotations

from collections import Counter
from copy import deepcopy
import heapq


class HuffmanNode:
    def __init__(self, node_id, label, frequency, order, left=None, right=None, character=None):
        self.id = node_id
        self.label = label
        self.frequency = frequency
        self.order = order
        self.left = left
        self.right = right
        self.character = character

    @property
    def is_leaf(self):
        return self.left is None and self.right is None


class HuffmanTraceBuilder:
    def __init__(self, text):
        self.text = text
        self.steps = []
        self.final_codes = {}
        self.encoded_text = ""
        self._final_root = None
        self._node_counter = 0
        self._step_counter = 0
        self._codes_so_far = {}
        self._full_encoded = ""

    def build(self):
        if not self.text:
            raise ValueError("Input text must not be empty.")

        frequency_counter = Counter()
        appearance_order = []
        seen = set()

        self._push_step(
            title="Ready to analyze the input",
            description="Start with the raw text. The algorithm will count character frequencies before building the min heap.",
            frequency_table=[],
            heap_state=[],
            roots=[],
            focus_nodes=[],
            codes={},
            encoded_partial="",
            current_character_index=None,
            current_character=None,
            phase="initialize",
        )

        for index, character in enumerate(self.text):
            if character not in seen:
                seen.add(character)
                appearance_order.append(character)
            frequency_counter[character] += 1
            self._push_step(
                title=f"Count character {self._display_char(character)}",
                description=f"Scan position {index + 1} and increment the frequency for {self._display_char(character)}.",
                frequency_table=self._build_frequency_entries(
                    active_nodes=[],
                    counter=frequency_counter,
                    appearance_order=appearance_order,
                    highlight_label=character,
                ),
                heap_state=[],
                roots=[],
                focus_nodes=[],
                codes={},
                encoded_partial="",
                current_character_index=index,
                current_character=character,
                phase="count",
            )

        heap = []
        roots = []

        self._push_step(
            title="Frequency table complete",
            description="All character counts are available. Next, each distinct character becomes a leaf node in the min heap.",
            frequency_table=self._build_frequency_entries(
                active_nodes=[],
                counter=frequency_counter,
                appearance_order=appearance_order,
            ),
            heap_state=[],
            roots=[],
            focus_nodes=[],
            codes={},
            encoded_partial="",
            current_character_index=None,
            current_character=None,
            phase="count",
        )

        for order, character in enumerate(appearance_order):
            node = self._make_leaf(character, frequency_counter[character], order)
            heapq.heappush(heap, (node.frequency, node.order, node))
            roots = [item[2] for item in sorted(heap, key=lambda entry: (entry[0], entry[1]))]

            self._push_step(
                title=f"Insert {self._display_char(character)} into the heap",
                description=f"Create a leaf node for {self._display_char(character)} with frequency {node.frequency} and push it into the priority queue.",
                frequency_table=self._build_frequency_entries(active_nodes=roots),
                heap_state=self._heap_entries(heap, selected_ids=[node.id]),
                roots=roots,
                focus_nodes=[node.id],
                codes={},
                encoded_partial="",
                current_character_index=None,
                current_character=None,
                phase="heap",
            )

        while len(heap) > 1:
            left = heapq.heappop(heap)[2]
            right = heapq.heappop(heap)[2]

            remaining = [item[2] for item in sorted(heap, key=lambda entry: (entry[0], entry[1]))]
            merge_view = [left, right] + remaining

            self._push_step(
                title=f"Select {self._display_label(left.label)} and {self._display_label(right.label)}",
                description="Remove the two minimum-frequency nodes from the heap. They will become siblings under a new internal parent.",
                frequency_table=self._build_frequency_entries(
                    active_nodes=remaining,
                    consumed_nodes=[left, right],
                ),
                heap_state=self._heap_entries(heap, selected_ids=[left.id, right.id], popped_nodes=[left, right]),
                roots=merge_view,
                focus_nodes=[left.id, right.id],
                codes=deepcopy(self._codes_so_far),
                encoded_partial="",
                current_character_index=None,
                current_character=None,
                phase="merge",
            )

            parent = self._make_parent(left, right)
            merge_forest = [parent] + remaining

            self._push_step(
                title=f"Merge nodes into {self._display_label(parent.label)}",
                description="The two smallest nodes are merged into a new parent whose frequency is the sum of its children.",
                frequency_table=self._build_frequency_entries(
                    active_nodes=remaining,
                    consumed_nodes=[left, right],
                    created_nodes=[parent],
                ),
                heap_state=self._heap_entries(heap, selected_ids=[left.id, right.id], created_nodes=[parent]),
                roots=merge_forest,
                focus_nodes=[parent.id, left.id, right.id],
                codes=deepcopy(self._codes_so_far),
                encoded_partial="",
                current_character_index=None,
                current_character=None,
                phase="merge",
            )

            heapq.heappush(heap, (parent.frequency, parent.order, parent))
            roots = [item[2] for item in sorted(heap, key=lambda entry: (entry[0], entry[1]))]

            self._push_step(
                title=f"Push {self._display_label(parent.label)} back into the heap",
                description="Reinsert the merged subtree so it can participate in the next minimum-frequency comparison.",
                frequency_table=self._build_frequency_entries(active_nodes=roots),
                heap_state=self._heap_entries(heap, selected_ids=[parent.id]),
                roots=roots,
                focus_nodes=[parent.id],
                codes=deepcopy(self._codes_so_far),
                encoded_partial="",
                current_character_index=None,
                current_character=None,
                phase="merge",
            )

        root = heap[0][2]
        self._final_root = root

        self._push_step(
            title="Huffman tree complete",
            description="Only one node remains in the heap. This node is the root of the finished Huffman tree.",
            frequency_table=self._build_frequency_entries(active_nodes=[root]),
            heap_state=self._heap_entries(heap, selected_ids=[root.id]),
            roots=[root],
            focus_nodes=[root.id],
            codes=deepcopy(self._codes_so_far),
            encoded_partial="",
            current_character_index=None,
            current_character=None,
            phase="tree-complete",
        )

        self._assign_codes(root, prefix="")
        self.final_codes = deepcopy(self._codes_so_far)
        self._full_encoded = "".join(self.final_codes[ch] for ch in self.text)

        self._push_step(
            title="All binary codes assigned",
            description="Each leaf now has a complete binary code obtained from its root-to-leaf path.",
            frequency_table=self._build_frequency_entries(active_nodes=[root]),
            heap_state=self._heap_entries(heap, selected_ids=[root.id]),
            roots=[root],
            focus_nodes=[root.id],
            codes=deepcopy(self.final_codes),
            encoded_partial="",
            current_character_index=None,
            current_character=None,
            phase="codes-complete",
        )

        encoded_partial = ""
        for index, character in enumerate(self.text):
            encoded_partial += self.final_codes[character]
            self._push_step(
                title=f"Encode {self._display_char(character)}",
                description=f"Append the Huffman code for {self._display_char(character)} to the output bitstream.",
                frequency_table=self._build_frequency_entries(active_nodes=[root]),
                heap_state=self._heap_entries(heap, selected_ids=[root.id]),
                roots=[root],
                focus_nodes=[root.id, self._find_node_id_for_char(root, character)],
                codes=deepcopy(self.final_codes),
                encoded_partial=encoded_partial,
                emitted_bits=self.final_codes[character],
                current_character_index=index,
                current_character=character,
                phase="encode",
            )

        self.encoded_text = encoded_partial

        self._push_step(
            title="Encoding complete",
            description="The full text has been converted into its Huffman-encoded binary representation.",
            frequency_table=self._build_frequency_entries(active_nodes=[root]),
            heap_state=self._heap_entries(heap, selected_ids=[root.id]),
            roots=[root],
            focus_nodes=[root.id],
            codes=deepcopy(self.final_codes),
            encoded_partial=self.encoded_text,
            current_character_index=None,
            current_character=None,
            phase="complete",
        )

        return {
            "input_text": self.text,
            "encoded_text": self.encoded_text,
            "steps": self.steps,
            "final_codes": self.final_codes,
            "tree": self._serialize_tree(root),
        }

    def _assign_codes(self, node, prefix):
        if node.is_leaf:
            code = prefix or "0"
            self._codes_so_far[node.character] = code
            self._push_step(
                title=f"Assign code to {self._display_char(node.character)}",
                description=f"Reach leaf {self._display_char(node.character)} and store code {code}.",
                frequency_table=self._build_frequency_entries(active_nodes=[self._final_root]),
                heap_state=[],
                roots=[self._final_root],
                focus_nodes=[node.id],
                codes=deepcopy(self._codes_so_far),
                encoded_partial="",
                emitted_bits=code,
                current_character_index=None,
                current_character=node.character,
                phase="codes",
            )
            return

        if node.left is not None:
            self._assign_codes(node.left, prefix + "0")
        if node.right is not None:
            self._assign_codes(node.right, prefix + "1")

    def _push_step(
        self,
        title,
        description,
        frequency_table,
        heap_state,
        roots,
        focus_nodes,
        codes,
        encoded_partial,
        current_character_index,
        current_character,
        phase,
        emitted_bits="",
    ):
        tree = {
            "id": f"forest-{self._step_counter}",
            "label": "forest",
            "frequency": sum(root.frequency for root in roots) if roots else 0,
            "virtual": True,
            "children": [self._serialize_tree(root) for root in roots],
        }

        self.steps.append(
            {
                "step": self._step_counter,
                "title": title,
                "description": description,
                "phase": phase,
                "frequency_table": frequency_table,
                "heap_state": heap_state,
                "tree": tree,
                "codes": codes,
                "encoded_partial": encoded_partial,
                "encoded_text": self._full_encoded,
                "emitted_bits": emitted_bits,
                "current_character_index": current_character_index,
                "current_character": current_character,
                "focus_nodes": focus_nodes,
                "input_text": self.text,
            }
        )
        self._step_counter += 1

    def _make_leaf(self, character, frequency, order):
        self._node_counter += 1
        return HuffmanNode(
            node_id=f"node-{self._node_counter}",
            label=character,
            frequency=frequency,
            order=order,
            character=character,
        )

    def _make_parent(self, left, right):
        self._node_counter += 1
        label = "".join(sorted((left.label + right.label), key=lambda char: (len(char), char)))
        return HuffmanNode(
            node_id=f"node-{self._node_counter}",
            label=label,
            frequency=left.frequency + right.frequency,
            order=1000 + self._node_counter,
            left=left,
            right=right,
        )

    def _build_frequency_entries(self, active_nodes, counter=None, appearance_order=None, highlight_label=None, consumed_nodes=None, created_nodes=None):
        entries = []
        active_nodes = active_nodes or []
        consumed_nodes = consumed_nodes or []
        created_nodes = created_nodes or []

        if counter is not None and appearance_order is not None:
            for character in appearance_order:
                entries.append(
                    {
                        "id": f"count-{character}",
                        "label": self._display_char(character),
                        "raw_label": character,
                        "frequency": counter[character],
                        "type": "leaf",
                        "status": "active" if character != highlight_label else "focus",
                    }
                )
            return entries

        for node in sorted(active_nodes, key=lambda item: (item.frequency, item.order, item.label)):
            entries.append(
                {
                    "id": node.id,
                    "label": self._display_label(node.label),
                    "raw_label": node.label,
                    "frequency": node.frequency,
                    "type": "leaf" if node.is_leaf else "internal",
                    "status": "active",
                }
            )

        for node in consumed_nodes:
            entries.append(
                {
                    "id": f"consumed-{node.id}",
                    "label": self._display_label(node.label),
                    "raw_label": node.label,
                    "frequency": node.frequency,
                    "type": "leaf" if node.is_leaf else "internal",
                    "status": "consumed",
                }
            )

        for node in created_nodes:
            entries.append(
                {
                    "id": f"created-{node.id}",
                    "label": self._display_label(node.label),
                    "raw_label": node.label,
                    "frequency": node.frequency,
                    "type": "internal",
                    "status": "created",
                }
            )

        return entries

    def _heap_entries(self, heap, selected_ids=None, popped_nodes=None, created_nodes=None):
        selected_ids = selected_ids or []
        popped_nodes = popped_nodes or []
        created_nodes = created_nodes or []
        entries = []

        for frequency, order, node in sorted(heap, key=lambda item: (item[0], item[1])):
            entries.append(
                {
                    "id": node.id,
                    "label": self._display_label(node.label),
                    "frequency": frequency,
                    "status": "focus" if node.id in selected_ids else "active",
                }
            )

        for node in popped_nodes:
            entries.append(
                {
                    "id": f"popped-{node.id}",
                    "label": self._display_label(node.label),
                    "frequency": node.frequency,
                    "status": "popped",
                }
            )

        for node in created_nodes:
            entries.append(
                {
                    "id": f"created-{node.id}",
                    "label": self._display_label(node.label),
                    "frequency": node.frequency,
                    "status": "created",
                }
            )

        return entries

    def _serialize_tree(self, node):
        if node is None:
            return None

        payload = {
            "id": node.id,
            "label": self._display_label(node.label),
            "raw_label": node.label,
            "frequency": node.frequency,
            "character": node.character,
            "type": "leaf" if node.is_leaf else "internal",
        }

        children = []
        if node.left is not None:
            left_payload = self._serialize_tree(node.left)
            left_payload["edge"] = "0"
            children.append(left_payload)
        if node.right is not None:
            right_payload = self._serialize_tree(node.right)
            right_payload["edge"] = "1"
            children.append(right_payload)
        if children:
            payload["children"] = children
        return payload

    def _find_node_id_for_char(self, node, character):
        if node is None:
            return None
        if node.character == character:
            return node.id
        left_match = self._find_node_id_for_char(node.left, character) if node.left else None
        if left_match:
            return left_match
        return self._find_node_id_for_char(node.right, character) if node.right else None

    def _display_char(self, character):
        if character == " ":
            return "space"
        if character == "\n":
            return "\\n"
        if character == "\t":
            return "\\t"
        return character

    def _display_label(self, label):
        return "".join(self._display_char(character) for character in label)


def encode_with_trace(text):
    return HuffmanTraceBuilder(text).build()
