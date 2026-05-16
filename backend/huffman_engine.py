from __future__ import annotations

from collections import Counter
from copy import deepcopy
import hashlib
import heapq
import json
import math


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


def _display_byte(byte_value):
    if byte_value == 32:
        return "space"
    if byte_value == 10:
        return "\\n"
    if byte_value == 13:
        return "\\r"
    if byte_value == 9:
        return "\\t"
    if 32 <= byte_value <= 126:
        return chr(byte_value)
    return f"0x{byte_value:02X}"


def _assign_byte_codes(node, prefix, codes):
    if node["type"] == "leaf":
        codes[node["byte"]] = prefix or "0"
        return

    children = node.get("children", [])
    if children:
        _assign_byte_codes(children[0], prefix + "0", codes)
    if len(children) > 1:
        _assign_byte_codes(children[1], prefix + "1", codes)


def _build_byte_tree_and_codes(data):
    counter = Counter(data)
    heap = []
    order = 0

    for byte_value in sorted(counter):
        node = {
            "id": f"byte-{byte_value}",
            "label": _display_byte(byte_value),
            "raw_label": str(byte_value),
            "frequency": counter[byte_value],
            "byte": byte_value,
            "type": "leaf",
        }
        heapq.heappush(heap, (counter[byte_value], order, node))
        order += 1

    if len(heap) == 1:
        root = heap[0][2]
        return root, {root["byte"]: "0"}, counter

    while len(heap) > 1:
        left_frequency, _, left_node = heapq.heappop(heap)
        right_frequency, _, right_node = heapq.heappop(heap)

        left_node["edge"] = "0"
        right_node["edge"] = "1"
        parent = {
            "id": f"internal-{order}",
            "label": str(left_frequency + right_frequency),
            "raw_label": "",
            "frequency": left_frequency + right_frequency,
            "type": "internal",
            "children": [left_node, right_node],
        }

        heapq.heappush(heap, (parent["frequency"], order, parent))
        order += 1

    root = heap[0][2]
    codes = {}
    _assign_byte_codes(root, "", codes)
    return root, codes, counter


def _pack_bitstring(bitstring):
    padding_bits = (8 - (len(bitstring) % 8)) % 8
    padded = bitstring + ("0" * padding_bits)
    payload = bytearray()

    for index in range(0, len(padded), 8):
        payload.append(int(padded[index:index + 8], 2))

    return bytes(payload), padding_bits


def _unpack_bitstring(payload, padding_bits):
    bitstring = "".join(f"{byte_value:08b}" for byte_value in payload)
    if padding_bits:
        return bitstring[:-padding_bits]
    return bitstring


def _decode_from_codes(bitstring, codes):
    reverse_codes = {code: int(byte_value) for byte_value, code in codes.items()}
    decoded = bytearray()
    current = ""

    for bit in bitstring:
        current += bit
        if current in reverse_codes:
            decoded.append(reverse_codes[current])
            current = ""

    if current:
        raise ValueError("Compressed payload ended with an incomplete Huffman code.")

    return bytes(decoded)


def compress_and_pack(data, filename="input.txt"):
    if not data:
        raise ValueError("Uploaded file must not be empty.")

    tree_data, codes, counter = _build_byte_tree_and_codes(data)
    encoded_bitstring = "".join(codes[byte_value] for byte_value in data)
    packed_payload, padding_bits = _pack_bitstring(encoded_bitstring)

    original_size = len(data)
    encoded_bits = len(encoded_bitstring)
    frequencies = {str(byte_value): count for byte_value, count in sorted(counter.items())}
    serializable_codes = {str(byte_value): code for byte_value, code in sorted(codes.items())}

    probabilities = [count / original_size for count in counter.values()]
    entropy = -sum(probability * math.log2(probability) for probability in probabilities)
    bits_per_symbol = encoded_bits / original_size

    metadata = {
        "format": "adaptive-huffman-demo",
        "version": 1,
        "filename": filename,
        "original_size": original_size,
        "original_sha256": hashlib.sha256(data).hexdigest(),
        "padding_bits": padding_bits,
        "frequencies": frequencies,
        "codes": serializable_codes,
    }
    metadata_bytes = json.dumps(metadata, separators=(",", ":"), sort_keys=True).encode("utf-8")
    header = len(metadata_bytes).to_bytes(4, "big") + metadata_bytes
    packed_file = header + packed_payload

    compressed_size = len(packed_file)
    compression_ratio = compressed_size / original_size
    stats = {
        "original_size": original_size,
        "compressed_size": compressed_size,
        "metadata_size": len(metadata_bytes),
        "payload_size": len(packed_payload),
        "encoded_bits": encoded_bits,
        "padding_bits": padding_bits,
        "compression_ratio": compression_ratio,
        "compression_ratio_percent": compression_ratio * 100,
        "space_savings_percent": (1 - compression_ratio) * 100,
        "bits_per_symbol": bits_per_symbol,
        "entropy": entropy,
        "verified": False,
    }

    top_10_freqs = [
        {
            "byte": byte_value,
            "label": _display_byte(byte_value),
            "frequency": count,
            "share_percent": (count / original_size) * 100,
        }
        for byte_value, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]

    return {
        "packed_file": packed_file,
        "metadata": metadata,
        "stats": stats,
        "tree_data": tree_data,
        "top_10_freqs": top_10_freqs,
        "encoded_bitstring": encoded_bitstring,
    }


def decompress_packed(packed_file):
    if len(packed_file) < 4:
        raise ValueError("Compressed file is missing its metadata header.")

    metadata_size = int.from_bytes(packed_file[:4], "big")
    metadata_start = 4
    metadata_end = metadata_start + metadata_size

    if len(packed_file) < metadata_end:
        raise ValueError("Compressed file metadata is incomplete.")

    metadata = json.loads(packed_file[metadata_start:metadata_end].decode("utf-8"))
    payload = packed_file[metadata_end:]
    bitstring = _unpack_bitstring(payload, int(metadata.get("padding_bits", 0)))
    decoded = _decode_from_codes(bitstring, metadata["codes"])

    if len(decoded) != int(metadata["original_size"]):
        raise ValueError("Decompressed size does not match metadata.")

    return decoded, metadata


def verify_decompression(packed_file, original_data):
    decoded, metadata = decompress_packed(packed_file)
    original_hash = hashlib.sha256(original_data).hexdigest()
    decoded_hash = hashlib.sha256(decoded).hexdigest()

    return {
        "ok": decoded == original_data and decoded_hash == original_hash == metadata.get("original_sha256"),
        "original_sha256": original_hash,
        "decoded_sha256": decoded_hash,
        "metadata_sha256": metadata.get("original_sha256"),
    }


class CompressionAnalyzer:
    def analyze(self, freq_table, codes, original_size, compressed_size, encoded_bits, padding_bits, metadata_size, payload_size):
        entropy = self.shannon_entropy(freq_table, original_size)
        average_bits = self.average_bits_per_symbol(freq_table, codes, original_size)
        redundancy = max(0, average_bits - entropy)
        efficiency = entropy / average_bits if average_bits else 0
        most_common = max(freq_table.values()) if freq_table else 0
        skew = most_common / original_size if original_size else 0
        ratio = compressed_size / original_size if original_size else 0

        return {
            "original_size": original_size,
            "compressed_size": compressed_size,
            "metadata_size": metadata_size,
            "payload_size": payload_size,
            "encoded_bits": encoded_bits,
            "padding_bits": padding_bits,
            "compression_ratio": ratio,
            "compression_ratio_percent": ratio * 100,
            "space_savings_percent": (1 - ratio) * 100,
            "entropy": entropy,
            "average_bits_per_symbol": average_bits,
            "average_code_length": average_bits,
            "bits_per_symbol": average_bits,
            "redundancy": redundancy,
            "efficiency": efficiency,
            "skew": skew,
        }

    def shannon_entropy(self, freq_table, total):
        entropy = 0
        for count in freq_table.values():
            probability = count / total
            entropy -= probability * math.log2(probability)
        return entropy

    def average_bits_per_symbol(self, freq_table, codes, total):
        return sum((count / total) * len(codes[byte_value]) for byte_value, count in freq_table.items())


class HuffmanProcessor:
    VISUAL_TREE_SYMBOL_LIMIT = 15

    def __init__(self):
        self._node_id = 0
        self.steps = []

    def compress(self, data, filename="input.txt"):
        if not data:
            raise ValueError("Uploaded file must not be empty.")

        self._node_id = 0
        self.steps = []
        freq_table = dict(sorted(Counter(data).items()))
        self._push_step(
            "Processing Frequencies",
            "Counted byte frequencies for the uploaded file.",
            None,
            freq_table,
            {},
        )

        root = self.build_huffman_tree(freq_table)
        codes = {}
        self._assign_codes(root, "", codes)
        self._push_step(
            "Tree Construction Complete",
            "Built the deterministic Huffman tree and assigned binary codes.",
            root,
            freq_table,
            codes,
        )

        bit_string = "".join(codes[byte_value] for byte_value in data)
        payload_bytes, padding_bits = self.pack_to_binary(bit_string)
        original_hash = hashlib.sha256(data).hexdigest()
        header, metadata = self.generate_header(freq_table, padding_bits, len(data), original_hash)
        metadata_bytes = header[4:]
        packed_file = header + payload_bytes
        bitstream_diagnostics = self._build_bitstream_diagnostics(
            data=data,
            bit_string=bit_string,
            codes=codes,
            labels={byte_value: self._display_byte(byte_value) for byte_value in sorted(freq_table)},
            padding_bits=padding_bits,
            header_bit_count=len(header) * 8,
            header_preview_bits=self._bytes_to_bits(header[:16]),
            total_bytes=len(packed_file),
        )
        verification = self.decompress_and_verify(packed_file)
        verified = verification["status"] == "Integrity Verified"

        original_size = len(data)
        encoded_bits = len(bit_string)
        compressed_size = len(packed_file)
        metrics = CompressionAnalyzer().analyze(
            freq_table=freq_table,
            codes=codes,
            original_size=original_size,
            compressed_size=compressed_size,
            encoded_bits=encoded_bits,
            padding_bits=padding_bits,
            metadata_size=len(metadata_bytes),
            payload_size=len(payload_bytes),
        )
        metrics["filename"] = filename
        metrics["verified"] = verified
        metrics["status"] = verification["status"]
        metadata_breakdown = self.get_metadata(metrics)
        comparison = {
            "fixed_ascii_bits": self.calculate_theoretical_limit(original_size),
            "huffman_bits": encoded_bits,
            "packed_file_bits": compressed_size * 8,
        }
        dynamic_insights = self.generate_dynamic_insight(
            entropy=metrics["entropy"],
            ratio=metrics["compression_ratio_percent"],
            skew=metrics["skew"],
            freq_table=freq_table,
        )

        self._push_step(
            "Bitstream Packed",
            "Converted the encoded bit string into bytes and wrote the metadata header.",
            root,
            freq_table,
            codes,
        )
        self._push_step(
            "SHA-256 Check: Verified" if verified else "SHA-256 Check: Failed",
            verification["status"],
            root,
            freq_table,
            codes,
        )

        visual_root = self.build_visual_huffman_tree(freq_table)

        return {
            "packed_file": packed_file,
            "encoded_payload": payload_bytes,
            "metadata": metadata,
            "metrics": metrics,
            "stats": metrics,
            "metadata_breakdown": metadata_breakdown,
            "comparison": comparison,
            "dynamic_insights": dynamic_insights,
            "tree_data": self._serialize_tree(root),
            "visual_tree_data": self._serialize_tree(visual_root),
            "visual_tree_limit": self.VISUAL_TREE_SYMBOL_LIMIT,
            "top_10_freqs": self._top_frequencies(freq_table, original_size),
            "frequency_table": self._frequency_rows(freq_table, original_size),
            "codes": {str(byte_value): code for byte_value, code in sorted(codes.items())},
            "labels": {str(byte_value): self._display_byte(byte_value) for byte_value in sorted(freq_table)},
            "bitstream_peek": bitstream_diagnostics["preview_bits"],
            "bitstream_diagnostics": bitstream_diagnostics,
            "steps": self.steps,
            "verification": verification,
        }

    def compress_file(self, file_path):
        with open(file_path, "rb") as handle:
            data = handle.read()
        return self.compress(data, filename=str(file_path))

    def build_visual_huffman_tree(self, freq_table):
        visual_symbols = sorted(freq_table.items(), key=lambda item: (-item[1], item[0]))[:self.VISUAL_TREE_SYMBOL_LIMIT]
        visual_freq_table = dict(sorted(visual_symbols))
        return self.build_huffman_tree(visual_freq_table)

    def get_metadata(self, metrics):
        return {
            "payload_size_bytes": metrics["payload_size"],
            "header_size_bytes": metrics["metadata_size"] + 4,
            "padding_bits": metrics["padding_bits"],
        }

    def calculate_theoretical_limit(self, original_size):
        return original_size * 8

    def generate_dynamic_insight(self, entropy, ratio, skew, freq_table=None):
        insights = []
        freq_table = freq_table or {}
        common_vowels = 0
        for byte_value in (97, 101, 105, 111, 117, 65, 69, 73, 79, 85):
            common_vowels += freq_table.get(byte_value, 0)
        total = sum(freq_table.values()) or 1
        vowel_share = common_vowels / total

        if skew >= 0.35:
            insights.append("Character skew analysis: a small set of symbols dominates the file, improving Huffman code efficiency.")
        if vowel_share >= 0.25:
            insights.append("Character skew analysis: high frequency of vowels detected, improving compression ratio for text-like input.")
        if entropy < 4:
            insights.append("Entropy analysis: low uncertainty indicates repeated structure and strong compression potential.")
        elif entropy >= 7:
            insights.append("Entropy analysis: symbols are close to uniformly distributed, limiting prefix-code savings.")
        if ratio < 75:
            insights.append("Encoding outcome: Huffman payload is materially smaller than fixed 8-bit representation.")
        elif ratio >= 100:
            insights.append("Encoding outcome: metadata overhead offsets the packed payload savings for this file.")

        return insights or ["Compression profile: moderate symbol skew with balanced entropy; gains depend on file size and metadata overhead."]

    def build_huffman_tree(self, freq_table):
        heap = []

        for byte_value, frequency in sorted(freq_table.items()):
            node = {
                "id": self._next_node_id(),
                "byte": byte_value,
                "label": self._display_byte(byte_value),
                "frequency": frequency,
                "type": "leaf",
                "min_character": f"{byte_value:03d}",
            }
            heapq.heappush(heap, (frequency, node["min_character"], node["id"], node))

        if len(heap) == 1:
            return heap[0][3]

        while len(heap) > 1:
            left_frequency, left_character, _, left = heapq.heappop(heap)
            right_frequency, right_character, _, right = heapq.heappop(heap)
            left["edge"] = "0"
            right["edge"] = "1"
            parent_character = min(left_character, right_character)
            parent = {
                "id": self._next_node_id(),
                "label": str(left_frequency + right_frequency),
                "frequency": left_frequency + right_frequency,
                "type": "internal",
                "min_character": parent_character,
                "children": [left, right],
            }
            heapq.heappush(heap, (parent["frequency"], parent_character, parent["id"], parent))

        return heap[0][3]

    def pack_to_binary(self, bit_string):
        padding_bits = (8 - (len(bit_string) % 8)) % 8
        padded = bit_string + ("0" * padding_bits)
        output = bytearray()
        current = 0
        bit_count = 0

        for bit in padded:
            current = (current << 1) | (1 if bit == "1" else 0)
            bit_count += 1
            if bit_count == 8:
                output.append(current)
                current = 0
                bit_count = 0

        return bytes(output), padding_bits

    def pack_bytes(self, bit_string):
        return self.pack_to_binary(bit_string)

    def generate_header(self, freq_table, padding_count, original_size, original_hash=None):
        metadata = {
            "freq_table": {str(byte_value): count for byte_value, count in sorted(freq_table.items())},
            "padding_bits": padding_count,
            "original_size": original_size,
            "original_hash": original_hash or "",
        }
        metadata_bytes = json.dumps(metadata, separators=(",", ":"), sort_keys=True).encode("utf-8")
        return len(metadata_bytes).to_bytes(4, "big", signed=False) + metadata_bytes, metadata

    def verify_compression(self, original_text, decompressed_text):
        if isinstance(original_text, str):
            original_text = original_text.encode("utf-8")
        if isinstance(decompressed_text, str):
            decompressed_text = decompressed_text.encode("utf-8")
        return hashlib.sha256(original_text).hexdigest() == hashlib.sha256(decompressed_text).hexdigest()

    def decompress_and_verify(self, file_bytes):
        if len(file_bytes) < 4:
            raise ValueError("Compressed file is missing its metadata header.")

        metadata_length = int.from_bytes(file_bytes[:4], "big", signed=False)
        metadata_start = 4
        metadata_end = metadata_start + metadata_length
        if len(file_bytes) < metadata_end:
            raise ValueError("Compressed file metadata is incomplete.")

        metadata = json.loads(file_bytes[metadata_start:metadata_end].decode("utf-8"))
        freq_table = {int(byte_value): count for byte_value, count in metadata["freq_table"].items()}
        root = self.build_huffman_tree(freq_table)
        payload = file_bytes[metadata_end:]
        bit_string = self._unpack_bytes(payload, int(metadata["padding_bits"]))
        decoded = self._decode_bits(bit_string, root)
        decoded_hash = hashlib.sha256(decoded).hexdigest()
        original_hash = metadata.get("original_hash", "")
        size_ok = len(decoded) == int(metadata.get("original_size", len(decoded)))
        hash_ok = decoded_hash == original_hash if original_hash else True

        return {
            "status": "Integrity Verified" if size_ok and hash_ok else "Integrity Failed",
            "ok": size_ok and hash_ok,
            "decoded": decoded,
            "decoded_hash": decoded_hash,
            "original_hash": original_hash,
            "metadata": metadata,
        }

    def _next_node_id(self):
        self._node_id += 1
        return self._node_id

    def _assign_codes(self, node, prefix, codes):
        if node["type"] == "leaf":
            codes[node["byte"]] = prefix or "0"
            return

        children = node.get("children", [])
        if children:
            self._assign_codes(children[0], prefix + "0", codes)
        if len(children) > 1:
            self._assign_codes(children[1], prefix + "1", codes)

    def _unpack_bytes(self, payload, padding_bits):
        bits = []
        for byte_value in payload:
            for shift in range(7, -1, -1):
                bits.append("1" if byte_value & (1 << shift) else "0")

        if padding_bits:
            bits = bits[:-padding_bits]
        return "".join(bits)

    def _decode_bits(self, bit_string, root):
        if root["type"] == "leaf":
            return bytes([root["byte"]]) * len(bit_string)

        decoded = bytearray()
        node = root
        for bit in bit_string:
            node = node["children"][0 if bit == "0" else 1]
            if node["type"] == "leaf":
                decoded.append(node["byte"])
                node = root

        if node is not root:
            raise ValueError("Compressed payload ended with an incomplete Huffman code.")
        return bytes(decoded)

    def _serialize_tree(self, node):
        payload = {
            "id": f"node-{node['id']}",
            "label": node["label"],
            "frequency": node["frequency"],
            "type": node["type"],
        }
        if node["type"] == "leaf":
            payload["byte"] = node["byte"]

        children = []
        for child in node.get("children", []):
            child_payload = self._serialize_tree(child)
            child_payload["edge"] = child.get("edge", "")
            children.append(child_payload)
        if children:
            payload["children"] = children
        return payload

    def _push_step(self, title, description, root, freq_table, codes):
        self.steps.append(
            {
                "title": title,
                "description": description,
                "tree_data": self._serialize_tree(root) if root else None,
                "frequency_table": self._top_frequencies(freq_table, sum(freq_table.values()) or 1),
                "codes": {str(byte_value): code for byte_value, code in sorted(codes.items())},
            }
        )

    def _entropy(self, freq_table, total):
        entropy = 0
        for count in freq_table.values():
            probability = count / total
            entropy -= probability * math.log2(probability)
        return entropy

    def _top_frequencies(self, freq_table, total):
        return [
            {
                "byte": byte_value,
                "label": self._display_byte(byte_value),
                "frequency": count,
                "share_percent": (count / total) * 100,
            }
            for byte_value, count in sorted(freq_table.items(), key=lambda item: (-item[1], item[0]))[:10]
        ]

    def _frequency_rows(self, freq_table, total):
        return [
            {
                "byte": byte_value,
                "label": self._display_byte(byte_value),
                "frequency": count,
                "share_percent": (count / total) * 100,
            }
            for byte_value, count in sorted(freq_table.items(), key=lambda item: (-item[1], item[0]))
        ]

    def _build_bitstream_diagnostics(self, data, bit_string, codes, labels, padding_bits, header_bit_count, header_preview_bits, total_bytes, preview_limit=512):
        preview_data_bits = bit_string[:preview_limit]
        visible_data_bits = len(preview_data_bits)
        visible_padding_bits = ""
        if len(bit_string) <= preview_limit and padding_bits:
            visible_padding_bits = "0" * padding_bits

        bit_to_symbol = {}
        symbol_spans = []
        cursor = 0

        for byte_value in data:
            code = codes[byte_value]
            start = cursor
            end = cursor + len(code)
            if start >= preview_limit:
                break

            visible_end = min(end, preview_limit)
            entry = {
                "symbol": labels[byte_value],
                "byte": byte_value,
                "code": code,
                "start": start,
                "end": end,
                "visible_start": start,
                "visible_end": visible_end,
            }
            symbol_spans.append(entry)

            for bit_index in range(start, visible_end):
                bit_to_symbol[str(bit_index)] = {
                    "symbol": labels[byte_value],
                    "byte": byte_value,
                    "code": code,
                    "start": start,
                    "end": end,
                }

            cursor = end

        return {
            "header_bit_count": header_bit_count,
            "header_preview_bits": header_preview_bits,
            "ascii_preview_bits": self._bytes_to_bits(data[:32]),
            "payload_bit_count": len(bit_string),
            "padding_bits": padding_bits,
            "total_bytes": total_bytes,
            "preview_limit": preview_limit,
            "preview_bits": preview_data_bits + visible_padding_bits,
            "visible_data_bits": visible_data_bits,
            "visible_padding_bits": len(visible_padding_bits),
            "has_more": len(bit_string) > preview_limit,
            "bit_to_symbol": bit_to_symbol,
            "symbol_spans": symbol_spans,
        }

    def _bytes_to_bits(self, payload):
        return "".join(f"{byte_value:08b}" for byte_value in payload)

    def _display_byte(self, byte_value):
        if byte_value == 32:
            return "space"
        if byte_value == 10:
            return "\\n"
        if byte_value == 13:
            return "\\r"
        if byte_value == 9:
            return "\\t"
        if 32 <= byte_value <= 126:
            return chr(byte_value)
        return f"0x{byte_value:02X}"


def compress_and_pack(data, filename="input.txt"):
    return HuffmanProcessor().compress(data, filename=filename)


def decompress_packed(packed_file):
    result = HuffmanProcessor().decompress_and_verify(packed_file)
    return result["decoded"], result["metadata"]


def verify_decompression(packed_file, original_data):
    result = HuffmanProcessor().decompress_and_verify(packed_file)
    original_hash = hashlib.sha256(original_data).hexdigest()
    ok = result["ok"] and result["decoded_hash"] == original_hash
    return {
        "ok": ok,
        "status": "Integrity Verified" if ok else "Integrity Failed",
        "original_sha256": original_hash,
        "decoded_sha256": result["decoded_hash"],
        "metadata_sha256": result["original_hash"],
    }
