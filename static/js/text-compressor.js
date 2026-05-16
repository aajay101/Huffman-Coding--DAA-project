(function() {
    "use strict";

    const IDE_COMPRESSOR = {
        PRUNE_NODE_THRESHOLD: 31,
        PRUNE_DEPTH: 5,
        payload: null,
        steps: [],
        currentStep: -1,
        downloadUrl: null,
        resizeObserver: null,
        frequencyChart: null,
        activeTab: "tree",
        bitstreamExpanded: false,
        highlightedCode: null,
        highlightedByte: null,
        modalCleanup: null,

        utils: {
            escapeHtml(value) {
                return String(value)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
            },

            byId(id) {
                return document.getElementById(id);
            },

            setText(id, value) {
                const element = this.byId(id);
                if (element) element.textContent = value;
            },

            formatBytes(bytes) {
                const value = Number(bytes);
                if (!Number.isFinite(value)) return "NaN";
                if (value < 1024) return `${Math.round(value)} B`;
                if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
                return `${(value / (1024 * 1024)).toFixed(2)} MB`;
            },

            formatPercentage(value) {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) return "NaN";
                return `${numeric.toFixed(2)}%`;
            },

            formatBits(bits) {
                const value = Number(bits);
                if (!Number.isFinite(value)) return "NaN";
                return `${Math.round(value).toLocaleString()} bits`;
            },

            formatEntropy(value) {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) return "NaN";
                return numeric.toFixed(3);
            }
        },

        METRIC_DEFINITIONS: {
            original_size: {
                title: "Original Size",
                category: "File",
                icon: "file-text",
                definition: "The number of source bytes read from the uploaded text file before encoding.",
                formula: "N = |X|",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatBytes(stats.original_size)} input`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatBytes(stats.original_size);
                },
                interpretation(stats) {
                    return Number(stats.original_size) > 0 ? "This is the baseline used by every ratio and savings calculation." : "Metric data unavailable. Process a file to inspect.";
                },
                why_it_matters: "Small files can compress poorly because the JSON metadata header may dominate the payload savings.",
                related_metrics: ["compressed_size", "compression_ratio_percent", "space_savings_percent"],
                dependencies: []
            },
            compressed_size: {
                title: "Compressed Size",
                category: "File",
                icon: "archive",
                definition: "The full packed .huff output size, including the metadata header and encoded payload.",
                formula: "C = Bₕₑₐdₑᵣ + Bₚₐyₗₒₐd",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatBytes(stats.metadata_size + 4)} + ${IDE_COMPRESSOR.utils.formatBytes(stats.payload_size)}`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatBytes(stats.compressed_size);
                },
                interpretation(stats) {
                    return Number(stats.compressed_size) <= Number(stats.original_size) ? "The packed file is smaller than the input." : "The packed file is larger than the input, usually from metadata overhead or high entropy.";
                },
                why_it_matters: "This is the real storage cost users download, not just the ideal Huffman payload.",
                related_metrics: ["payload_size", "metadata_size", "compression_ratio_percent"],
                dependencies: ["metadata_size", "payload_size"]
            },
            compression_ratio_percent: {
                title: "Compression Ratio",
                category: "Outcome",
                icon: "percent",
                definition: "The compressed file size divided by original input size, expressed as a percentage.",
                formula: "ρ = (C ÷ N) × 100%",
                substitution(stats) {
                    return `(${IDE_COMPRESSOR.utils.formatBytes(stats.compressed_size)} / ${IDE_COMPRESSOR.utils.formatBytes(stats.original_size)}) x 100`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatPercentage(stats.compression_ratio_percent);
                },
                interpretation(stats) {
                    const ratio = Number(stats.compression_ratio_percent);
                    if (!Number.isFinite(ratio)) return "Metric data unavailable. Process a file to inspect.";
                    if (ratio < 75) return "Strong compression result for a full packaged file.";
                    if (ratio < 100) return "The output is smaller, but gains are modest.";
                    return "The output is larger than the input after packaging overhead.";
                },
                why_it_matters: "It summarizes the practical effectiveness of the compressor in one comparable value.",
                related_metrics: ["space_savings_percent", "entropy", "compressed_size"],
                dependencies: ["original_size", "compressed_size"]
            },
            entropy: {
                title: "Shannon Entropy",
                category: "Information Theory",
                icon: "activity",
                definition: "The theoretical lower bound for average bits per symbol under the observed byte distribution.",
                formula: "H(X) = −Σ pᵢ log₂(pᵢ)",
                substitution(stats) {
                    return `H(X) = ${IDE_COMPRESSOR.utils.formatEntropy(stats.entropy)} bits/symbol`;
                },
                result(stats) {
                    return `${IDE_COMPRESSOR.utils.formatEntropy(stats.entropy)} bits/symbol`;
                },
                interpretation(stats) {
                    const entropy = Number(stats.entropy);
                    if (!Number.isFinite(entropy)) return "Metric data unavailable. Process a file to inspect.";
                    if (entropy < 4) return "Low uncertainty indicates repeated structure and strong coding opportunity.";
                    if (entropy >= 7) return "The distribution is close to uniform, limiting prefix-code savings.";
                    return "Moderate uncertainty; realized savings depend on code lengths and file size.";
                },
                why_it_matters: "Entropy explains how much compression is theoretically possible before implementation overhead.",
                related_metrics: ["average_code_length", "redundancy", "efficiency"],
                dependencies: ["frequency_table"]
            },
            efficiency: {
                title: "Coding Efficiency",
                category: "Information Theory",
                icon: "gauge",
                definition: "How close the average Huffman code length is to the Shannon entropy bound.",
                formula: "η = H(X) ÷ Lₐᵥg",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatEntropy(stats.entropy)} / ${IDE_COMPRESSOR.utils.formatEntropy(stats.average_code_length)}`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatPercentage(Number(stats.efficiency) * 100);
                },
                interpretation(stats) {
                    const efficiency = Number(stats.efficiency);
                    if (!Number.isFinite(efficiency)) return "Metric data unavailable. Process a file to inspect.";
                    if (efficiency >= 0.95) return "The code lengths are very close to the entropy limit.";
                    if (efficiency >= 0.85) return "The generated code is efficient, with limited unavoidable slack.";
                    return "The symbol distribution or small sample size leaves more coding slack.";
                },
                why_it_matters: "Efficiency separates algorithmic coding quality from metadata and packaging overhead.",
                related_metrics: ["entropy", "average_code_length", "redundancy"],
                dependencies: ["entropy", "average_code_length"]
            },
            redundancy: {
                title: "Redundancy",
                category: "Information Theory",
                icon: "minus-circle",
                definition: "The gap between average Huffman code length and Shannon entropy.",
                formula: "R = Lₐᵥg − H(X)",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatEntropy(stats.average_code_length)} - ${IDE_COMPRESSOR.utils.formatEntropy(stats.entropy)}`;
                },
                result(stats) {
                    return `${IDE_COMPRESSOR.utils.formatEntropy(stats.redundancy)} bits/symbol`;
                },
                interpretation(stats) {
                    const redundancy = Number(stats.redundancy);
                    if (!Number.isFinite(redundancy)) return "Metric data unavailable. Process a file to inspect.";
                    if (redundancy < 0.1) return "Very little coding overhead above the theoretical bound.";
                    if (redundancy < 0.5) return "A normal amount of prefix-code overhead.";
                    return "A wider gap exists between ideal entropy and realized code lengths.";
                },
                why_it_matters: "Redundancy shows how much room remains after Huffman coding itself.",
                related_metrics: ["entropy", "average_code_length", "efficiency"],
                dependencies: ["entropy", "average_code_length"]
            },
            average_code_length: {
                title: "Average Code Length",
                category: "Encoding",
                icon: "binary",
                definition: "The frequency-weighted mean number of Huffman bits emitted per source byte.",
                formula: "Lₐᵥg = Σ pᵢℓᵢ",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatEntropy(stats.average_code_length)} weighted bits/symbol`;
                },
                result(stats) {
                    return `${IDE_COMPRESSOR.utils.formatEntropy(stats.average_code_length)} bits/symbol`;
                },
                interpretation(stats) {
                    return "Lower values mean common symbols were assigned shorter codes.";
                },
                why_it_matters: "This metric is the practical Huffman counterpart to entropy.",
                related_metrics: ["entropy", "redundancy", "encoded_bits"],
                dependencies: ["frequency_table", "codes"]
            },
            encoded_bits: {
                title: "Encoded Payload Bits",
                category: "Encoding",
                icon: "rows",
                definition: "The number of meaningful Huffman payload bits before byte padding is added.",
                formula: "Bₑₙcₒdₑd = Σ ℓ(xⱼ)",
                substitution(stats) {
                    return IDE_COMPRESSOR.utils.formatBits(stats.encoded_bits);
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatBits(stats.encoded_bits);
                },
                interpretation(stats) {
                    return "This is the compressed signal before byte alignment and header bytes.";
                },
                why_it_matters: "It isolates the core encoding result from packaging overhead.",
                related_metrics: ["payload_size", "padding_bits", "average_code_length"],
                dependencies: ["codes"]
            },
            payload_size: {
                title: "Payload Size",
                category: "Container",
                icon: "package",
                definition: "The byte-aligned Huffman payload size after padding.",
                formula: "Bₚₐyₗₒₐd = ⌈Bₑₙcₒdₑd ÷ 8⌉",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatBits(stats.encoded_bits)} packed to ${IDE_COMPRESSOR.utils.formatBytes(stats.payload_size)}`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatBytes(stats.payload_size);
                },
                interpretation(stats) {
                    return "This is the binary payload excluding JSON metadata.";
                },
                why_it_matters: "It shows the true byte cost of the encoded bitstream.",
                related_metrics: ["encoded_bits", "padding_bits", "compressed_size"],
                dependencies: ["encoded_bits", "padding_bits"]
            },
            metadata_size: {
                title: "Metadata / Header Size",
                category: "Container",
                icon: "braces",
                definition: "The file header bytes needed to reconstruct and verify the compressed file.",
                formula: "Bₕₑₐdₑᵣ = Bⱼₛₒₙ + 4",
                substitution(stats) {
                    return `${IDE_COMPRESSOR.utils.formatBytes(stats.metadata_size)} + 4 B`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatBytes(Number(stats.metadata_size) + 4);
                },
                interpretation(stats) {
                    return "Header overhead is fixed by tree metadata, source size, padding, and integrity hash.";
                },
                why_it_matters: "A correct standalone .huff file needs enough metadata to decode without hidden state.",
                related_metrics: ["compressed_size", "payload_size"],
                dependencies: []
            },
            padding_bits: {
                title: "Padding Bits",
                category: "Container",
                icon: "align-end-horizontal",
                definition: "Zero bits appended so the Huffman payload ends on a byte boundary.",
                formula: "P = (8 − (Bₑₙcₒdₑd mod 8)) mod 8",
                substitution(stats) {
                    return IDE_COMPRESSOR.utils.formatBits(stats.padding_bits);
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatBits(stats.padding_bits);
                },
                interpretation(stats) {
                    return "Padding is ignored during decompression using the header value.";
                },
                why_it_matters: "Bit-level compression still has to be stored in byte-addressed files.",
                related_metrics: ["encoded_bits", "payload_size"],
                dependencies: ["encoded_bits"]
            },
            space_savings_percent: {
                title: "Space Savings",
                category: "Outcome",
                icon: "scissors",
                definition: "How much smaller the compressed file is compared with the original.",
                formula: "S = (1 − C ÷ N) × 100%",
                substitution(stats) {
                    return `(1 - ${IDE_COMPRESSOR.utils.formatBytes(stats.compressed_size)} / ${IDE_COMPRESSOR.utils.formatBytes(stats.original_size)}) x 100`;
                },
                result(stats) {
                    return IDE_COMPRESSOR.utils.formatPercentage(stats.space_savings_percent);
                },
                interpretation(stats) {
                    const savings = Number(stats.space_savings_percent);
                    if (!Number.isFinite(savings)) return "Metric data unavailable. Process a file to inspect.";
                    return savings > 0 ? "The packaged output saves storage." : "The packaged output does not save storage for this input.";
                },
                why_it_matters: "Savings is often easier to reason about than compressed/original ratio.",
                related_metrics: ["compression_ratio_percent", "compressed_size"],
                dependencies: ["original_size", "compressed_size"]
            },
            integrity_verification: {
                title: "Integrity Verification",
                category: "Verification",
                icon: "shield-check",
                definition: "The SHA-256 digest of the decoded output must match the uploaded file digest stored in the header.",
                formula: "SHA-256(decoded) ≡ SHA-256(original)",
                substitution(stats) {
                    return stats.verified ? "Decoded SHA-256 matches original SHA-256." : "Integrity has not been verified for this file.";
                },
                result(stats) {
                    return stats.verified ? "Verified" : "Pending";
                },
                interpretation(stats) {
                    return stats.verified ? "The packed file was decoded and matched the original input." : "Metric data unavailable. Process a file to inspect.";
                },
                why_it_matters: "Compression is only useful if the file can be reconstructed exactly.",
                related_metrics: ["compressed_size", "metadata_size", "payload_size"],
                dependencies: ["sha256"]
            }
        },

        inspector: {
            unavailable: "Metric data unavailable. Process a file to inspect.",

            theory: {
                original_size: {
                    simple: "Original size is the amount of source data the compressor received before doing any coding.",
                    equation: '<span class="tc-eq-symbol">N</span><span class="tc-eq-op">=</span><span class="tc-abs">X</span>',
                    components: [
                        ["N", "Original file size in bytes"],
                        ["X", "The uploaded file as a sequence of bytes"],
                        ["|X|", "The count of bytes in that sequence"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `N = ${compressor.utils.formatBytes(stats.original_size)}`,
                            `The baseline contains ${Number(stats.original_size || 0).toLocaleString()} source bytes.`
                        ];
                    }
                },
                compressed_size: {
                    simple: "Compressed size is the full downloadable file: the header plus the packed Huffman payload.",
                    equation: '<span class="tc-eq-symbol">C</span><span class="tc-eq-op">=</span><span>B<sub>header</sub></span><span class="tc-eq-op">+</span><span>B<sub>payload</sub></span>',
                    components: [
                        ["C", "Total compressed file size"],
                        ["Bₕₑₐdₑᵣ", "Metadata bytes needed to decode the file"],
                        ["Bₚₐyₗₒₐd", "Byte-aligned Huffman encoded data"]
                    ],
                    substitution(compressor, stats) {
                        const header = Number(stats.metadata_size) + 4;
                        return [
                            `C = ${compressor.utils.formatBytes(header)} + ${compressor.utils.formatBytes(stats.payload_size)}`,
                            `C = ${compressor.utils.formatBytes(stats.compressed_size)}`
                        ];
                    }
                },
                compression_ratio_percent: {
                    simple: "Compression ratio tells you how large the packed file is compared with the original.",
                    equation: '<span class="tc-eq-symbol">ρ</span><span class="tc-eq-op">=</span><span class="tc-fraction"><span>C</span><span>N</span></span><span class="tc-eq-op">×</span><span>100%</span>',
                    components: [
                        ["ρ", "Compression ratio"],
                        ["C", "Compressed file size"],
                        ["N", "Original file size"],
                        ["100%", "Converts the ratio into a percentage"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `ρ = (${compressor.utils.formatBytes(stats.compressed_size)} ÷ ${compressor.utils.formatBytes(stats.original_size)}) × 100%`,
                            `ρ = ${compressor.utils.formatPercentage(stats.compression_ratio_percent)}`
                        ];
                    }
                },
                entropy: {
                    simple: "Entropy measures how unpredictable the uploaded file is. Lower entropy usually means better compression opportunities.",
                    equation: '<span>H(X)</span><span class="tc-eq-op">=</span><span class="tc-eq-op">−</span><span class="tc-sigma"><sup>n</sup><span>Σ</span><sub>i=1</sub></span><span>p<sub>i</sub></span><span>log<sub>2</sub>(p<sub>i</sub>)</span>',
                    components: [
                        ["H(X)", "Shannon entropy of the uploaded file"],
                        ["Σ", "Sum across every distinct symbol"],
                        ["pᵢ", "Probability that symbol i appears"],
                        ["log₂", "Logarithm base 2, measuring information in bits"],
                        ["n", "Number of distinct symbols in the file"]
                    ],
                    substitution(compressor, stats) {
                        const terms = compressor.inspector.entropyTerms(compressor);
                        return [
                            terms.length
                                ? `H(X) = −(${terms.join(" + ")} + …)`
                                : "H(X) = −Σ pᵢ log₂(pᵢ)",
                            `H(X) = ${compressor.utils.formatEntropy(stats.entropy)} bits/symbol`
                        ];
                    }
                },
                efficiency: {
                    simple: "Efficiency shows how close the Huffman code is to the best possible average code length.",
                    equation: '<span>η</span><span class="tc-eq-op">=</span><span class="tc-fraction"><span>H(X)</span><span>L<sub>avg</sub></span></span><span class="tc-eq-op">×</span><span>100%</span>',
                    components: [
                        ["η", "Coding efficiency"],
                        ["H(X)", "Entropy limit for the file"],
                        ["Lₐᵥg", "Average Huffman code length"],
                        ["100%", "Converts the fraction into a percentage"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `η = (${compressor.utils.formatEntropy(stats.entropy)} ÷ ${compressor.utils.formatEntropy(stats.average_code_length)}) × 100%`,
                            `η = ${compressor.utils.formatPercentage(Number(stats.efficiency) * 100)}`
                        ];
                    }
                },
                redundancy: {
                    simple: "Redundancy is the remaining gap between the Huffman code and the entropy limit.",
                    equation: '<span>R</span><span class="tc-eq-op">=</span><span>L<sub>avg</sub></span><span class="tc-eq-op">−</span><span>H(X)</span>',
                    components: [
                        ["R", "Redundancy above the entropy limit"],
                        ["Lₐᵥg", "Average Huffman code length"],
                        ["H(X)", "Theoretical entropy lower bound"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `R = ${compressor.utils.formatEntropy(stats.average_code_length)} − ${compressor.utils.formatEntropy(stats.entropy)}`,
                            `R = ${compressor.utils.formatEntropy(stats.redundancy)} bits/symbol`
                        ];
                    }
                },
                average_code_length: {
                    simple: "Average code length is the typical number of Huffman bits used for one source byte.",
                    equation: '<span>L<sub>avg</sub></span><span class="tc-eq-op">=</span><span class="tc-sigma"><sup>n</sup><span>Σ</span><sub>i=1</sub></span><span>p<sub>i</sub></span><span>ℓ<sub>i</sub></span>',
                    components: [
                        ["Lₐᵥg", "Average Huffman code length"],
                        ["Σ", "Sum across all symbols"],
                        ["pᵢ", "Probability of symbol i"],
                        ["ℓᵢ", "Bit length of symbol i's Huffman code"]
                    ],
                    substitution(compressor, stats) {
                        const terms = compressor.inspector.lengthTerms(compressor);
                        return [
                            terms.length ? `Lₐᵥg = ${terms.join(" + ")} + …` : "Lₐᵥg = Σ pᵢℓᵢ",
                            `Lₐᵥg = ${compressor.utils.formatEntropy(stats.average_code_length)} bits/symbol`
                        ];
                    }
                },
                encoded_bits: {
                    simple: "Encoded bits are the meaningful Huffman bits before padding fills the last byte.",
                    equation: '<span>B<sub>encoded</sub></span><span class="tc-eq-op">=</span><span class="tc-sigma"><sup>N</sup><span>Σ</span><sub>j=1</sub></span><span>ℓ(x<sub>j</sub>)</span>',
                    components: [
                        ["Bₑₙcₒdₑd", "Meaningful Huffman payload bits"],
                        ["xⱼ", "The j-th byte in the uploaded file"],
                        ["ℓ(xⱼ)", "Length of that byte's Huffman code"],
                        ["N", "Number of source bytes"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `Bₑₙcₒdₑd = ${Number(stats.encoded_bits || 0).toLocaleString()} meaningful bits`,
                            `Bₑₙcₒdₑd = ${compressor.utils.formatBits(stats.encoded_bits)}`
                        ];
                    }
                },
                payload_size: {
                    simple: "Payload size is the encoded bitstream rounded up to whole bytes so it can be stored in a file.",
                    equation: '<span>B<sub>payload</sub></span><span class="tc-eq-op">=</span><span>⌈</span><span class="tc-fraction"><span>B<sub>encoded</sub></span><span>8</span></span><span>⌉</span>',
                    components: [
                        ["Bₚₐyₗₒₐd", "Stored Huffman payload size in bytes"],
                        ["Bₑₙcₒdₑd", "Meaningful Huffman bits"],
                        ["8", "Number of bits in one byte"],
                        ["⌈ ⌉", "Round up to the next whole byte"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `Bₚₐyₗₒₐd = ⌈${Number(stats.encoded_bits || 0).toLocaleString()} ÷ 8⌉`,
                            `Bₚₐyₗₒₐd = ${compressor.utils.formatBytes(stats.payload_size)}`
                        ];
                    }
                },
                metadata_size: {
                    simple: "Metadata size is the decoding guide stored with the payload: frequencies, padding, size, and integrity hash.",
                    equation: '<span>B<sub>header</sub></span><span class="tc-eq-op">=</span><span>B<sub>json</sub></span><span class="tc-eq-op">+</span><span>4</span>',
                    components: [
                        ["Bₕₑₐdₑᵣ", "Total header size"],
                        ["Bⱼₛₒₙ", "Serialized JSON metadata bytes"],
                        ["4", "Bytes used to store the JSON header length"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `Bₕₑₐdₑᵣ = ${compressor.utils.formatBytes(stats.metadata_size)} + 4 B`,
                            `Bₕₑₐdₑᵣ = ${compressor.utils.formatBytes(Number(stats.metadata_size) + 4)}`
                        ];
                    }
                },
                padding_bits: {
                    simple: "Padding is the small number of zero bits added so the payload ends exactly on a byte boundary.",
                    equation: '<span>P</span><span class="tc-eq-op">=</span><span>(8 − (B<sub>encoded</sub> mod 8)) mod 8</span>',
                    components: [
                        ["P", "Padding bits"],
                        ["Bₑₙcₒdₑd", "Meaningful Huffman bits"],
                        ["mod", "Remainder after division"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `P = (8 − (${Number(stats.encoded_bits || 0).toLocaleString()} mod 8)) mod 8`,
                            `P = ${compressor.utils.formatBits(stats.padding_bits)}`
                        ];
                    }
                },
                space_savings_percent: {
                    simple: "Space savings tells you how much storage was saved compared with keeping the original file.",
                    equation: '<span>S</span><span class="tc-eq-op">=</span><span>(1 − </span><span class="tc-fraction"><span>C</span><span>N</span></span><span>)</span><span class="tc-eq-op">×</span><span>100%</span>',
                    components: [
                        ["S", "Space savings"],
                        ["C", "Compressed file size"],
                        ["N", "Original file size"],
                        ["1 − C/N", "The fraction of storage removed"]
                    ],
                    substitution(compressor, stats) {
                        return [
                            `S = (1 − ${compressor.utils.formatBytes(stats.compressed_size)} ÷ ${compressor.utils.formatBytes(stats.original_size)}) × 100%`,
                            `S = ${compressor.utils.formatPercentage(stats.space_savings_percent)}`
                        ];
                    }
                },
                integrity_verification: {
                    simple: "Integrity verification proves that decompression reconstructs the exact uploaded bytes.",
                    equation: '<span>SHA-256(decoded)</span><span class="tc-eq-op">≡</span><span>SHA-256(original)</span>',
                    components: [
                        ["SHA-256", "Cryptographic file fingerprint"],
                        ["decoded", "Bytes reconstructed from the compressed file"],
                        ["original", "Uploaded source bytes"],
                        ["≡", "Exact digest match"]
                    ],
                    substitution(compressor, stats) {
                        const digest = stats.sha256 ? `${String(stats.sha256).slice(0, 16)}…` : "pending";
                        return [
                            `stored digest = ${digest}`,
                            stats.verified ? "decoded digest ≡ original digest" : "decoded digest is pending"
                        ];
                    }
                }
            },

            renderMetricModal(compressor, key, stats) {
                const definition = compressor.METRIC_DEFINITIONS[key];
                const content = compressor.utils.byId("tc-metric-modal-content");
                if (!definition || !content) return;

                const hasStats = stats && Object.keys(stats).length > 0;
                const theory = this.theory[key] || this.genericTheory(definition);
                const related = (definition.related_metrics || [])
                    .filter((metricKey) => compressor.METRIC_DEFINITIONS[metricKey])
                    .map((metricKey) => {
                        const metric = compressor.METRIC_DEFINITIONS[metricKey];
                        return `<button class="tc-related-chip" type="button" data-related-metric="${compressor.utils.escapeHtml(metricKey)}">${compressor.utils.escapeHtml(metric.title)}</button>`;
                    }).join("");
                const dependencies = (definition.dependencies || []).length
                    ? definition.dependencies.map((dependency) => `<code>${compressor.utils.escapeHtml(dependency)}</code>`).join("")
                    : "<span>None</span>";
                const html = [
                    '<article class="tc-metric-inspector">',
                    '<header class="tc-modal-header">',
                    "<div>",
                    `<span class="tc-kicker">${compressor.utils.escapeHtml(definition.category)} | ${compressor.utils.escapeHtml(definition.icon)}</span>`,
                    `<h2>${compressor.utils.escapeHtml(definition.title)}</h2>`,
                    "</div>",
                    '<button class="tc-modal-close" type="button" aria-label="Close metric inspector">Close</button>',
                    "</header>",
                    hasStats ? [
                        '<section class="tc-modal-result" aria-label="Result">',
                        "<span>Result</span>",
                        `<strong>${compressor.utils.escapeHtml(definition.result(stats))}</strong>`,
                        "</section>",
                        '<section class="tc-inspector-section">',
                        "<h3>In Simple Terms</h3>",
                        `<p>${compressor.utils.escapeHtml(theory.simple)}</p>`,
                        "</section>",
                        this.renderFormulaBlock(key),
                        this.renderComponents(compressor, key),
                        this.renderSubstitution(compressor, key, theory, stats),
                        '<section class="tc-inspector-section">',
                        "<h3>Interpretation</h3>",
                        `<p>${compressor.utils.escapeHtml(definition.interpretation(stats))}</p>`,
                        "</section>",
                        '<section class="tc-inspector-section">',
                        "<h3>Why It Matters</h3>",
                        `<p>${compressor.utils.escapeHtml(definition.why_it_matters)}</p>`,
                        "</section>",
                        '<section class="tc-inspector-section">',
                        "<h3>Dependencies</h3>",
                        `<div class="tc-dependency-list">${dependencies}</div>`,
                        "</section>"
                    ].join("") : `<div class="tc-empty-state">${this.unavailable}</div>`,
                    '<section class="tc-related-metrics" aria-label="Related metrics">',
                    "<span>Related metrics</span>",
                    `<div>${related || "<em>No related metrics.</em>"}</div>`,
                    "</section>",
                    "</article>"
                ].join("");

                content.innerHTML = html;
                const close = content.querySelector(".tc-modal-close");
                if (close) close.addEventListener("click", () => {
                    if (compressor.modalCleanup) compressor.modalCleanup();
                }, { once: true });
            },

            math(markup) {
                return `<span class="tc-math">${markup}</span>`;
            },

            variable(base, subscript) {
                return this.math(`${base}<sub>${subscript}</sub>`);
            },

            equationFor(key) {
                const v = (base, subscript) => this.variable(base, subscript);
                const m = (markup) => this.math(markup);
                const equations = {
                    original_size: `${m("N")}<span class="tc-eq-op">=</span><span class="tc-abs">${m("X")}</span>`,
                    compressed_size: `${m("C")}<span class="tc-eq-op">=</span>${v("B", "header")}<span class="tc-eq-op">+</span>${v("B", "payload")}`,
                    compression_ratio_percent: `${m("&rho;")}<span class="tc-eq-op">=</span><span class="tc-fraction"><span>${m("C")}</span><span>${m("N")}</span></span><span class="tc-eq-op">&times;</span>${m("100%")}`,
                    entropy: `${m("H(X)")}<span class="tc-eq-op">=</span><span class="tc-eq-op">&minus;</span><span class="tc-sigma"><sup>n</sup><span>&Sigma;</span><sub>i=1</sub></span>${v("p", "i")}${m("log<sub>2</sub>(")}${v("p", "i")}${m(")")}`,
                    efficiency: `${m("&eta;")}<span class="tc-eq-op">=</span><span class="tc-fraction"><span>${m("H(X)")}</span><span>${v("L", "avg")}</span></span><span class="tc-eq-op">&times;</span>${m("100%")}`,
                    redundancy: `${m("R")}<span class="tc-eq-op">=</span>${v("L", "avg")}<span class="tc-eq-op">&minus;</span>${m("H(X)")}`,
                    average_code_length: `${v("L", "avg")}<span class="tc-eq-op">=</span><span class="tc-sigma"><sup>n</sup><span>&Sigma;</span><sub>i=1</sub></span>${v("p", "i")}${v("&ell;", "i")}`,
                    encoded_bits: `${v("B", "encoded")}<span class="tc-eq-op">=</span><span class="tc-sigma"><sup>N</sup><span>&Sigma;</span><sub>j=1</sub></span>${m("&ell;(")}${v("x", "j")}${m(")")}`,
                    payload_size: `${v("B", "payload")}<span class="tc-eq-op">=</span>${m("&lceil;")}<span class="tc-fraction"><span>${v("B", "encoded")}</span><span>${m("8")}</span></span>${m("&rceil;")}`,
                    metadata_size: `${v("B", "header")}<span class="tc-eq-op">=</span>${v("B", "json")}<span class="tc-eq-op">+</span>${m("4")}`,
                    padding_bits: `${m("P")}<span class="tc-eq-op">=</span>${m("(8 &minus; (")}${v("B", "encoded")}${m(" mod 8)) mod 8")}`,
                    space_savings_percent: `${m("S")}<span class="tc-eq-op">=</span>${m("(1 &minus;")}<span class="tc-fraction"><span>${m("C")}</span><span>${m("N")}</span></span>${m(")")}<span class="tc-eq-op">&times;</span>${m("100%")}`,
                    integrity_verification: `${m("SHA-256(decoded)")}<span class="tc-eq-op">&equiv;</span>${m("SHA-256(original)")}`
                };
                return equations[key] || `${m("M")}<span class="tc-eq-op">=</span>${m("computed value")}`;
            },

            componentsFor(key) {
                const sets = {
                    original_size: [["N", "Original file size in bytes"], ["X", "The uploaded file as a byte sequence"], ["|X|", "Count of bytes in that sequence"]],
                    compressed_size: [["C", "Total compressed file size"], ["B_header", "Metadata bytes needed to decode the file"], ["B_payload", "Byte-aligned Huffman encoded data"]],
                    compression_ratio_percent: [["rho", "Compression ratio"], ["C", "Compressed file size"], ["N", "Original file size"], ["100%", "Converts the ratio into a percentage"]],
                    entropy: [["H(X)", "Shannon entropy of the uploaded file"], ["Sigma", "Sum across every distinct symbol"], ["p_i", "Probability that symbol i appears"], ["log_2", "Logarithm base 2, measuring information in bits"], ["n", "Number of distinct symbols in the file"]],
                    efficiency: [["eta", "Coding efficiency"], ["H(X)", "Entropy limit for the file"], ["L_avg", "Average Huffman code length"], ["100%", "Converts the fraction into a percentage"]],
                    redundancy: [["R", "Redundancy above the entropy limit"], ["L_avg", "Average Huffman code length"], ["H(X)", "Theoretical entropy lower bound"]],
                    average_code_length: [["L_avg", "Average Huffman code length"], ["Sigma", "Sum across all symbols"], ["p_i", "Probability of symbol i"], ["ell_i", "Bit length of symbol i's Huffman code"]],
                    encoded_bits: [["B_encoded", "Meaningful Huffman payload bits"], ["x_j", "The j-th byte in the uploaded file"], ["ell_x_j", "Length of that byte's Huffman code"], ["N", "Number of source bytes"]],
                    payload_size: [["B_payload", "Stored Huffman payload size in bytes"], ["B_encoded", "Meaningful Huffman bits"], ["8", "Number of bits in one byte"], ["ceil", "Round up to the next whole byte"]],
                    metadata_size: [["B_header", "Total header size"], ["B_json", "Serialized JSON metadata bytes"], ["4", "Bytes used to store the JSON header length"]],
                    padding_bits: [["P", "Padding bits"], ["B_encoded", "Meaningful Huffman bits"], ["mod", "Remainder after division"]],
                    space_savings_percent: [["S", "Space savings"], ["C", "Compressed file size"], ["N", "Original file size"], ["1-C/N", "Fraction of storage removed"]],
                    integrity_verification: [["SHA-256", "Cryptographic file fingerprint"], ["decoded", "Bytes reconstructed from the compressed file"], ["original", "Uploaded source bytes"], ["equiv", "Exact digest match"]]
                };
                return sets[key] || [["M", "Metric value"], ["value", "The metric produced from the uploaded file"]];
            },

            symbolFor(token) {
                const v = (base, subscript) => this.variable(base, subscript);
                const symbols = {
                    N: this.math("N"),
                    X: this.math("X"),
                    "|X|": `<span class="tc-abs">${this.math("X")}</span>`,
                    C: this.math("C"),
                    B_header: v("B", "header"),
                    B_payload: v("B", "payload"),
                    B_encoded: v("B", "encoded"),
                    B_json: v("B", "json"),
                    "100%": this.math("100%"),
                    rho: this.math("&rho;"),
                    eta: this.math("&eta;"),
                    "H(X)": this.math("H(X)"),
                    Sigma: this.math("&Sigma;"),
                    p_i: v("p", "i"),
                    log_2: this.math("log<sub>2</sub>"),
                    n: this.math("n"),
                    R: this.math("R"),
                    L_avg: v("L", "avg"),
                    ell_i: v("&ell;", "i"),
                    x_j: v("x", "j"),
                    ell_x_j: `${this.math("&ell;(")}${v("x", "j")}${this.math(")")}`,
                    "8": this.math("8"),
                    ceil: this.math("&lceil;&nbsp;&rceil;"),
                    P: this.math("P"),
                    mod: this.math("mod"),
                    S: this.math("S"),
                    "1-C/N": `${this.math("1")}<span class="tc-eq-op">&minus;</span><span class="tc-fraction tc-fraction-inline"><span>${this.math("C")}</span><span>${this.math("N")}</span></span>`,
                    "SHA-256": this.math("SHA-256"),
                    decoded: this.math("decoded"),
                    original: this.math("original"),
                    equiv: this.math("&equiv;"),
                    M: this.math("M"),
                    value: this.math("value")
                };
                return symbols[token] || this.math(token);
            },

            mathLine(left, right) {
                return `${left}<span class="tc-eq-op">=</span>${right}`;
            },

            substitutionFor(compressor, key, theory, stats) {
                const n = (value) => compressor.utils.escapeHtml(value);
                const v = (base, subscript) => this.variable(base, subscript);
                const m = (markup) => this.math(markup);
                const header = Number(stats.metadata_size) + 4;
                const encoded = Number(stats.encoded_bits || 0).toLocaleString();
                const substitutions = {
                    original_size: [
                        this.mathLine(m("N"), m(n(compressor.utils.formatBytes(stats.original_size)))),
                        `${m("N")} ${m("contains")} ${m(Number(stats.original_size || 0).toLocaleString())} ${m("source bytes")}`
                    ],
                    compressed_size: [
                        this.mathLine(m("C"), `${m(n(compressor.utils.formatBytes(header)))}<span class="tc-eq-op">+</span>${m(n(compressor.utils.formatBytes(stats.payload_size)))}`),
                        this.mathLine(m("C"), m(n(compressor.utils.formatBytes(stats.compressed_size))))
                    ],
                    compression_ratio_percent: [
                        `${m("&rho;")}<span class="tc-eq-op">=</span>${m("(")}${m(n(compressor.utils.formatBytes(stats.compressed_size)))}<span class="tc-eq-op">&divide;</span>${m(n(compressor.utils.formatBytes(stats.original_size)))}${m(")")}<span class="tc-eq-op">&times;</span>${m("100%")}`,
                        this.mathLine(m("&rho;"), m(n(compressor.utils.formatPercentage(stats.compression_ratio_percent))))
                    ],
                    entropy: [
                        this.entropyExpression(compressor),
                        this.mathLine(m("H(X)"), `${m(n(compressor.utils.formatEntropy(stats.entropy)))} ${m("bits/symbol")}`)
                    ],
                    efficiency: [
                        `${m("&eta;")}<span class="tc-eq-op">=</span>${m("(")}${m(n(compressor.utils.formatEntropy(stats.entropy)))}<span class="tc-eq-op">&divide;</span>${m(n(compressor.utils.formatEntropy(stats.average_code_length)))}${m(")")}<span class="tc-eq-op">&times;</span>${m("100%")}`,
                        this.mathLine(m("&eta;"), m(n(compressor.utils.formatPercentage(Number(stats.efficiency) * 100))))
                    ],
                    redundancy: [
                        `${m("R")}<span class="tc-eq-op">=</span>${m(n(compressor.utils.formatEntropy(stats.average_code_length)))}<span class="tc-eq-op">&minus;</span>${m(n(compressor.utils.formatEntropy(stats.entropy)))}`,
                        this.mathLine(m("R"), `${m(n(compressor.utils.formatEntropy(stats.redundancy)))} ${m("bits/symbol")}`)
                    ],
                    average_code_length: [
                        this.lengthExpression(compressor),
                        this.mathLine(v("L", "avg"), `${m(n(compressor.utils.formatEntropy(stats.average_code_length)))} ${m("bits/symbol")}`)
                    ],
                    encoded_bits: [
                        this.mathLine(v("B", "encoded"), `${m(encoded)} ${m("meaningful bits")}`),
                        this.mathLine(v("B", "encoded"), m(n(compressor.utils.formatBits(stats.encoded_bits))))
                    ],
                    payload_size: [
                        `${v("B", "payload")}<span class="tc-eq-op">=</span>${m("&lceil;")}${m(encoded)}<span class="tc-eq-op">&divide;</span>${m("8")}${m("&rceil;")}`,
                        this.mathLine(v("B", "payload"), m(n(compressor.utils.formatBytes(stats.payload_size))))
                    ],
                    metadata_size: [
                        `${v("B", "header")}<span class="tc-eq-op">=</span>${m(n(compressor.utils.formatBytes(stats.metadata_size)))}<span class="tc-eq-op">+</span>${m("4 B")}`,
                        this.mathLine(v("B", "header"), m(n(compressor.utils.formatBytes(header))))
                    ],
                    padding_bits: [
                        `${m("P")}<span class="tc-eq-op">=</span>${m("(8 &minus; (")}${m(encoded)} ${m("mod 8)) mod 8")}`,
                        this.mathLine(m("P"), m(n(compressor.utils.formatBits(stats.padding_bits))))
                    ],
                    space_savings_percent: [
                        `${m("S")}<span class="tc-eq-op">=</span>${m("(1 &minus;")}${m(n(compressor.utils.formatBytes(stats.compressed_size)))}<span class="tc-eq-op">&divide;</span>${m(n(compressor.utils.formatBytes(stats.original_size)))}${m(")")}<span class="tc-eq-op">&times;</span>${m("100%")}`,
                        this.mathLine(m("S"), m(n(compressor.utils.formatPercentage(stats.space_savings_percent))))
                    ],
                    integrity_verification: [
                        this.mathLine(m("stored digest"), m(n(stats.sha256 ? `${String(stats.sha256).slice(0, 16)}...` : "pending"))),
                        stats.verified ? `${m("decoded digest")}<span class="tc-eq-op">&equiv;</span>${m("original digest")}` : this.mathLine(m("decoded digest"), m("pending"))
                    ]
                };
                return substitutions[key] || theory.substitution(compressor, stats).map((line) => m(n(line)));
            },

            renderFormulaBlock(key) {
                return [
                    '<section class="tc-inspector-section">',
                    "<h3>Mathematical Formula</h3>",
                    '<div class="tc-formula-block">',
                    `<div class="tc-formula-equation">${this.equationFor(key)}</div>`,
                    "</div>",
                    "</section>"
                ].join("");
            },

            renderComponents(compressor, key) {
                return [
                    '<section class="tc-inspector-section">',
                    "<h3>Formula Components</h3>",
                    '<div class="tc-formula-components">',
                    this.componentsFor(key).map((component) => [
                        '<div class="tc-symbol-chip">',
                        `<span class="tc-symbol-token">${this.symbolFor(component[0])}</span>`,
                        `<span>${compressor.utils.escapeHtml(component[1])}</span>`,
                        "</div>"
                    ].join("")).join(""),
                    "</div>",
                    "</section>"
                ].join("");
            },

            renderSubstitution(compressor, key, theory, stats) {
                const substitutionLines = this.substitutionFor(compressor, key, theory, stats);
                const lines = substitutionLines.map((line, index, collection) => {
                    const labels = collection.length > 2 ? ["Formula", "Substitution", "Result"] : ["Substitution", "Result"];
                    const label = index === collection.length - 1 ? "Result" : (labels[index] || "Step");
                    return `<div><span class="tc-substitution-label">${label}</span><span class="tc-substitution-math">${line}</span></div>`;
                }).join("");
                return [
                    '<section class="tc-inspector-section">',
                    "<h3>File-Specific Substitution</h3>",
                    '<div class="tc-substitution-block">',
                    lines,
                    "</div>",
                    "</section>"
                ].join("");
            },

            entropyTerms(compressor) {
                return this.topFrequencyRows(compressor).map((row) => {
                    const probability = Number(row.share_percent) / 100;
                    return `${probability.toFixed(4)} × log₂(${probability.toFixed(4)})`;
                });
            },

            lengthTerms(compressor) {
                const codes = compressor.payload && compressor.payload.codes ? compressor.payload.codes : {};
                return this.topFrequencyRows(compressor).slice(0, 4).map((row) => {
                    const probability = Number(row.share_percent) / 100;
                    const code = codes[String(row.byte)] || "";
                    return `${probability.toFixed(4)} × ${code.length || "ℓ"}`;
                });
            },

            entropyTerms(compressor) {
                return this.topFrequencyRows(compressor).map((row) => {
                    const probability = Number(row.share_percent) / 100;
                    const value = compressor.utils.escapeHtml(probability.toFixed(4));
                    return `${this.math(value)}<span class="tc-eq-op">&times;</span>${this.math(`log<sub>2</sub>(${value})`)}`;
                });
            },

            entropyExpression(compressor) {
                const terms = this.entropyTerms(compressor);
                return terms.length
                    ? `${this.math("H(X)")}<span class="tc-eq-op">=</span><span class="tc-eq-op">&minus;</span>${this.math("(")}${terms.join('<span class="tc-eq-op">+</span>')}<span class="tc-eq-op">+</span>${this.math("...")}${this.math(")")}`
                    : `${this.math("H(X)")}<span class="tc-eq-op">=</span><span class="tc-eq-op">&minus;</span>${this.symbolFor("Sigma")} ${this.symbolFor("p_i")} ${this.symbolFor("log_2")}${this.math("(")}${this.symbolFor("p_i")}${this.math(")")}`;
            },

            lengthTerms(compressor) {
                const codes = compressor.payload && compressor.payload.codes ? compressor.payload.codes : {};
                return this.topFrequencyRows(compressor).slice(0, 4).map((row) => {
                    const probability = Number(row.share_percent) / 100;
                    const code = codes[String(row.byte)] || "";
                    const value = compressor.utils.escapeHtml(probability.toFixed(4));
                    const length = code.length ? String(code.length) : "&ell;";
                    return `${this.math(value)}<span class="tc-eq-op">&times;</span>${this.math(length)}`;
                });
            },

            lengthExpression(compressor) {
                const terms = this.lengthTerms(compressor);
                return terms.length
                    ? `${this.variable("L", "avg")}<span class="tc-eq-op">=</span>${terms.join('<span class="tc-eq-op">+</span>')}<span class="tc-eq-op">+</span>${this.math("...")}`
                    : `${this.variable("L", "avg")}<span class="tc-eq-op">=</span>${this.symbolFor("Sigma")} ${this.symbolFor("p_i")}${this.symbolFor("ell_i")}`;
            },

            topFrequencyRows(compressor) {
                const rows = compressor.payload ? (compressor.payload.frequency_table || compressor.payload.top_10_freqs || []) : [];
                return rows.slice(0, 4);
            },

            genericTheory(definition) {
                return {
                    simple: definition.definition,
                    equation: '<span>M</span><span class="tc-eq-op">=</span><span>computed value</span>',
                    components: [
                        ["M", definition.title],
                        ["value", "The metric produced from the uploaded file"]
                    ],
                    substitution(compressor, stats) {
                        return [definition.substitution(stats), definition.result(stats)];
                    }
                };
            },

            ensureMetricModal(compressor) {
                let modal = compressor.utils.byId("tc-metric-modal");
                if (modal) return modal;
                modal = document.createElement("div");
                modal.id = "tc-metric-modal";
                modal.className = "tc-metric-modal";
                modal.hidden = true;
                modal.setAttribute("role", "dialog");
                modal.setAttribute("aria-modal", "true");
                modal.innerHTML = '<div class="tc-metric-modal-card" tabindex="-1"><div id="tc-metric-modal-content"></div></div>';
                document.body.appendChild(modal);
                return modal;
            },

            openInspector(compressor, key, stats) {
                if (!compressor.METRIC_DEFINITIONS[key]) return;

                const modal = this.ensureMetricModal(compressor);
                const content = compressor.utils.byId("tc-metric-modal-content");
                const card = modal.querySelector(".tc-metric-modal-card");
                const sourceStats = stats || {};
                let loadingTimer = null;

                if (compressor.modalCleanup) compressor.modalCleanup();
                if (!content || !card) return;

                content.innerHTML = '<div class="tc-empty-state">Loading...</div>';
                modal.hidden = false;
                requestAnimationFrame(() => modal.classList.add("is-open"));

                loadingTimer = setTimeout(() => {
                    content.innerHTML = '<div class="tc-empty-state">Loading...</div>';
                }, 100);

                const close = () => {
                    clearTimeout(loadingTimer);
                    document.removeEventListener("keydown", onKeydown);
                    modal.removeEventListener("click", onBackdropClick);
                    content.removeEventListener("click", onRelatedClick);
                    modal.classList.remove("is-open");
                    modal.hidden = true;
                    content.innerHTML = "";
                    compressor.modalCleanup = null;
                };

                const onKeydown = (event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        close();
                        return;
                    }
                    if (event.key !== "Tab") return;
                    const focusable = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                        .filter((element) => !element.disabled && element.offsetParent !== null);
                    if (!focusable.length) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                };

                const onBackdropClick = (event) => {
                    if (event.target === modal) close();
                };

                const onRelatedClick = (event) => {
                    const link = event.target.closest("[data-related-metric]");
                    if (!link) return;
                    event.preventDefault();
                    this.openInspector(compressor, link.getAttribute("data-related-metric"), compressor.currentStats());
                };

                compressor.modalCleanup = close;
                document.addEventListener("keydown", onKeydown);
                modal.addEventListener("click", onBackdropClick);
                content.addEventListener("click", onRelatedClick);

                Promise.resolve().then(() => {
                    clearTimeout(loadingTimer);
                    this.renderMetricModal(compressor, key, sourceStats);
                    const firstButton = modal.querySelector(".tc-modal-close");
                    (firstButton || card).focus();
                });
            }
        },

        init() {
            const form = this.utils.byId("tc-upload-form");
            const fileInput = this.utils.byId("tc-file-input");
            const host = this.getTreeHost();
            const tabs = document.querySelectorAll("[data-tc-tab]");
            const more = this.utils.byId("tc-bitstream-more");

            if (form) {
                form.addEventListener("submit", (event) => {
                    event.preventDefault();
                    this.submitFile(fileInput && fileInput.files ? fileInput.files[0] : null);
                });
            }

            tabs.forEach((tab) => {
                tab.addEventListener("click", () => {
                    this.switchTab(tab.getAttribute("data-tc-tab"));
                });
            });

            if (more) {
                more.addEventListener("click", () => {
                    this.bitstreamExpanded = !this.bitstreamExpanded;
                    this.renderBitstreamInteractive();
                });
            }

            if (host && window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => this.renderState());
                this.resizeObserver.observe(host);
            }

            this.attachMetricInspectors();
            this.ensureMetricModal();
            this.updateDashboard({});
            this.renderState();
        },

        getTreeHost() {
            return this.utils.byId("tc-tree-viz") || this.utils.byId("tc-tree-host");
        },

        attachMetricInspectors() {
            const bindings = {
                "tc-original-size": "original_size",
                "tc-compressed-size": "compressed_size",
                "tc-ratio-value": "compression_ratio_percent",
                "tc-entropy": "entropy",
                "tc-efficiency": "efficiency",
                "tc-redundancy": "redundancy",
                "tc-payload-size": "payload_size",
                "tc-header-size": "metadata_size",
                "tc-padding-size": "padding_bits",
                "tc-integrity": "integrity_verification"
            };

            Object.keys(bindings).forEach((id) => {
                const value = this.utils.byId(id);
                const card = value ? value.closest(".tc-metric-card, .tc-breakdown-grid div, .tc-ratio-panel") : null;
                if (!card) return;
                card.tabIndex = 0;
                card.setAttribute("role", "button");
                card.setAttribute("aria-label", `Inspect ${this.METRIC_DEFINITIONS[bindings[id]].title}`);
                card.addEventListener("click", () => this.openInspector(bindings[id], this.currentStats()));
                card.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        this.openInspector(bindings[id], this.currentStats());
                    }
                });
            });
        },

        currentStats() {
            return this.payload ? (this.payload.metrics || this.payload.stats || {}) : {};
        },

        switchTab(tabName) {
            this.activeTab = tabName;
            document.querySelectorAll("[data-tc-tab]").forEach((tab) => {
                tab.classList.toggle("is-active", tab.getAttribute("data-tc-tab") === tabName);
            });
            document.querySelectorAll("[data-tc-panel]").forEach((panel) => {
                panel.classList.toggle("is-active", panel.getAttribute("data-tc-panel") === tabName);
            });
            if (tabName === "tree") this.renderState();
            if (tabName === "chart" && this.payload) this.renderFrequencyChart(this.payload.frequency_table || this.payload.top_10_freqs || []);
            if (tabName === "bitstream" && this.payload) this.renderBitstreamInteractive();
        },

        setBusy(isBusy) {
            const button = this.utils.byId("tc-compress-button");
            if (button) {
                button.disabled = isBusy;
                button.textContent = isBusy ? "Compressing..." : "Compress";
            }
            this.utils.setText("tc-status", isBusy ? "Processing file..." : "Ready.");
        },

        showError(message) {
            const error = this.utils.byId("tc-error");
            if (error) {
                error.textContent = message;
                error.hidden = false;
            }
            this.renderUnavailableState();
        },

        clearError() {
            const error = this.utils.byId("tc-error");
            if (!error) return;
            error.textContent = "";
            error.hidden = true;
        },

        submitFile(file) {
            if (!file) {
                this.showError("Choose a .txt file before compressing.");
                return;
            }

            const formData = new FormData();
            formData.append("file", file, file.name);

            this.clearError();
            this.resetDownload();
            this.setBusy(true);

            fetch("/compress_file", {
                method: "POST",
                body: formData
            })
                .then((response) => {
                    if (!response.ok) {
                        return response.json().then((payload) => {
                            throw new Error(payload.error || "Compression failed.");
                        });
                    }
                    return response.json();
                })
                .then((payload) => {
                    this.payload = payload;
                    this.steps = payload.steps || [];
                    this.currentStep = this.steps.length ? this.steps.length - 1 : -1;
                    this.updateAnalyticsDashboard(payload);
                    this.updateTables(payload);
                    this.renderFrequencyChart(payload.frequency_table || payload.top_10_freqs || []);
                    this.bitstreamExpanded = false;
                    this.renderBitstreamInteractive();
                    this.updateDownload(payload);
                    this.renderState();
                })
                .catch((error) => {
                    this.payload = null;
                    this.showError(error.message || "Unable to reach the compressor backend.");
                })
                .finally(() => {
                    this.setBusy(false);
                });
        },

        renderUnavailableState() {
            const fallback = "Metric data unavailable. Process a file to inspect.";
            this.updateDashboard({});
            this.renderMetadataBreakdown({});
            this.renderInsights([fallback]);
            const comparison = this.utils.byId("tc-comparison-chart");
            const frequencyBody = this.utils.byId("tc-frequency-body");
            const codeBody = this.utils.byId("tc-code-body");
            const bitstream = this.utils.byId("tc-bitstream-peek");
            if (comparison) comparison.innerHTML = `<div class="tc-empty-state">${fallback}</div>`;
            if (frequencyBody) frequencyBody.innerHTML = `<tr><td colspan="3">${fallback}</td></tr>`;
            if (codeBody) codeBody.innerHTML = `<tr><td colspan="2">${fallback}</td></tr>`;
            if (bitstream) bitstream.innerHTML = `<div class="tc-empty-state">${fallback}</div>`;
            this.renderState();
        },

        updateDashboard(metrics) {
            const stats = metrics || {};
            this.utils.setText("tc-original-size", stats.original_size === undefined ? "--" : this.utils.formatBytes(stats.original_size));
            this.utils.setText("tc-compressed-size", stats.compressed_size === undefined ? "--" : this.utils.formatBytes(stats.compressed_size));
            this.utils.setText("tc-entropy", stats.entropy === undefined ? "--" : this.utils.formatEntropy(stats.entropy));
            this.utils.setText("tc-efficiency", stats.efficiency === undefined ? "--" : this.utils.formatPercentage(Number(stats.efficiency) * 100));
            this.utils.setText("tc-ratio-value", stats.compression_ratio_percent === undefined ? "--" : this.utils.formatPercentage(stats.compression_ratio_percent));
            this.utils.setText("tc-redundancy", stats.redundancy === undefined ? "--" : this.utils.formatEntropy(stats.redundancy));
            this.utils.setText("tc-integrity", `Integrity: ${stats.verified ? "Verified" : "pending"}`);

            const fill = this.utils.byId("tc-ratio-fill");
            if (fill) {
                const ratio = Math.max(0, Math.min(100, Number(stats.compression_ratio_percent || 0)));
                fill.style.width = `${ratio}%`;
            }

            this.renderInsights(this.getCompressionInsights(stats.entropy, stats.compression_ratio_percent, stats.skew));
        },

        updateAnalyticsDashboard(data) {
            const metrics = data.metrics || data.stats || {};
            this.updateDashboard(metrics);
            this.renderMetadataBreakdown(data.metadata_breakdown || {});
            this.renderComparisonChart(data.comparison || {});
            this.renderInsights((data.dynamic_insights && data.dynamic_insights.length)
                ? data.dynamic_insights
                : this.getCompressionInsights(metrics.entropy, metrics.compression_ratio_percent, metrics.skew));
        },

        renderMetadataBreakdown(metadata) {
            this.utils.setText("tc-payload-size", metadata.payload_size_bytes === undefined ? "--" : this.utils.formatBytes(metadata.payload_size_bytes));
            this.utils.setText("tc-header-size", metadata.header_size_bytes === undefined ? "--" : this.utils.formatBytes(metadata.header_size_bytes));
            this.utils.setText("tc-padding-size", metadata.padding_bits === undefined ? "--" : this.utils.formatBits(metadata.padding_bits));
        },

        renderComparisonChart(comparison) {
            const root = this.utils.byId("tc-comparison-chart");
            if (!root) return;

            const rows = [
                { label: "Fixed 8-bit ASCII", value: Number(comparison.fixed_ascii_bits || 0), className: "is-ascii" },
                { label: "Huffman Payload", value: Number(comparison.huffman_bits || 0), className: "is-huffman" },
                { label: ".huff File Total", value: Number(comparison.packed_file_bits || 0), className: "is-total" }
            ];
            const max = rows.reduce((current, row) => Math.max(current, row.value), 1);

            root.innerHTML = rows.map((row) => {
                const width = Math.max(2, (row.value / max) * 100);
                return [
                    `<div class="tc-comparison-row ${this.utils.escapeHtml(row.className)}">`,
                    `<span>${this.utils.escapeHtml(row.label)}</span>`,
                    `<div class="tc-comparison-track"><i style="width:${width}%"></i></div>`,
                    `<strong>${this.utils.formatBits(row.value)}</strong>`,
                    "</div>"
                ].join("");
            }).join("");
        },

        getCompressionInsights(entropy, ratio, skew) {
            const insights = [];
            const entropyValue = Number(entropy || 0);
            const ratioValue = Number(ratio || 0);
            const skewValue = Number(skew || 0);

            if (!entropyValue && !ratioValue && !skewValue) return ["No analysis yet."];
            if (skewValue >= 0.35) insights.push("High symbol skew detected; this file is a strong Huffman candidate.");
            if (ratioValue < 75) insights.push("Compression ratio is favorable; encoded payload is materially smaller than input.");
            if (ratioValue >= 100) insights.push("Header overhead exceeds savings for this file size or distribution.");
            if (entropyValue < 4) insights.push("Low entropy indicates repeated structure and high redundancy.");
            if (entropyValue >= 7) insights.push("High entropy distribution leaves limited room for prefix-code compression.");
            return insights.length ? insights : ["Balanced distribution detected; compression gains depend on file size."];
        },

        renderInsights(insights) {
            const root = this.utils.byId("tc-insights");
            if (!root) return;
            root.innerHTML = (insights || []).map((insight) => `<li>${this.utils.escapeHtml(insight)}</li>`).join("");
        },

        updateTables(payload) {
            const frequencyBody = this.utils.byId("tc-frequency-body");
            const codeBody = this.utils.byId("tc-code-body");
            const frequencies = payload.top_10_freqs || [];
            const codes = payload.codes || {};

            if (frequencyBody) {
                frequencyBody.innerHTML = frequencies.length
                    ? frequencies.map((item) => [
                        "<tr>",
                        `<td>${this.utils.escapeHtml(item.label)}</td>`,
                        `<td>${this.utils.escapeHtml(item.frequency)}</td>`,
                        `<td>${this.utils.escapeHtml(this.utils.formatPercentage(item.share_percent))}</td>`,
                        "</tr>"
                    ].join("")).join("")
                    : '<tr><td colspan="3">No frequency data.</td></tr>';
            }

            if (codeBody) {
                const rows = Object.keys(codes).sort((left, right) => Number(left) - Number(right));
                codeBody.innerHTML = rows.length
                    ? rows.map((byteValue) => {
                        const label = payload.labels && payload.labels[byteValue] ? payload.labels[byteValue] : byteValue;
                        return [
                            `<tr data-tc-code-byte="${this.utils.escapeHtml(byteValue)}" data-tc-code="${this.utils.escapeHtml(codes[byteValue])}">`,
                            `<td>${this.utils.escapeHtml(label)}</td>`,
                            `<td><code>${this.utils.escapeHtml(codes[byteValue])}</code></td>`,
                            "</tr>"
                        ].join("");
                    }).join("")
                    : '<tr><td colspan="2">No codes generated.</td></tr>';
                this.attachCodeTableEvents();
            }
        },

        attachCodeTableEvents() {
            document.querySelectorAll("[data-tc-code-byte]").forEach((row) => {
                row.addEventListener("mouseenter", (event) => {
                    const target = event.currentTarget;
                    this.highlightSymbolBits(target.getAttribute("data-tc-code-byte"), target.getAttribute("data-tc-code"));
                    target.classList.add("is-linked");
                });
                row.addEventListener("mouseleave", (event) => {
                    event.currentTarget.classList.remove("is-linked");
                    this.clearBitMapping();
                });
            });
        },

        renderFrequencyChart(frequencies) {
            const bars = this.utils.byId("tc-frequency-bars");
            const canvas = this.utils.byId("tc-frequency-chart");
            const rows = (frequencies || []).slice(0, 20);
            if (canvas) canvas.hidden = true;
            if (!bars) return;
            const maxFrequency = rows.reduce((max, item) => Math.max(max, item.frequency), 1);
            bars.innerHTML = rows.length
                ? rows.map((item) => {
                    const width = Math.max(2, (item.frequency / maxFrequency) * 100);
                    return [
                        '<div class="tc-frequency-bar-row">',
                        `<span>${this.utils.escapeHtml(item.label)}</span>`,
                        `<div class="tc-frequency-bar-track"><i style="width:${width}%"></i></div>`,
                        `<strong>${this.utils.escapeHtml(item.frequency)}</strong>`,
                        "</div>"
                    ].join("");
                }).join("")
                : '<div class="tc-muted">No frequency data.</div>';
        },

        renderBitstreamInteractive() {
            const root = this.utils.byId("tc-bitstream-peek");
            const more = this.utils.byId("tc-bitstream-more");
            if (!root) return;

            const diagnostics = this.payload && this.payload.bitstream_diagnostics;
            if (!diagnostics || !diagnostics.preview_bits) {
                root.textContent = "No bitstream generated.";
                if (more) more.hidden = true;
                this.utils.setText("tc-bit-payload-count", "--");
                this.utils.setText("tc-bit-padding-count", "--");
                this.utils.setText("tc-bit-total-bytes", "--");
                return;
            }

            const renderLimit = this.bitstreamExpanded ? diagnostics.preview_bits.length : Math.min(256, diagnostics.preview_bits.length);
            const bits = diagnostics.preview_bits.slice(0, renderLimit);
            const headerBits = diagnostics.header_preview_bits || "";
            const html = [
                headerBits ? [
                    '<div class="tc-byte-container tc-byte-container-header" title="JSON header preview">',
                    `<span class="tc-byte-label">JSON header: ${this.utils.escapeHtml(diagnostics.header_bit_count)} bits</span>`,
                    this.renderByteGroups(headerBits, {
                        className: "tc-bitstream-bit is-header",
                        dataOffset: -headerBits.length
                    }),
                    "</div>"
                ].join("") : "",
                '<div class="tc-payload-stream">',
                this.renderByteGroups(bits, {
                    diagnostics,
                    dataOffset: 0
                }),
                "</div>"
            ].join("");

            this.utils.setText("tc-bit-payload-count", this.utils.formatBits(diagnostics.payload_bit_count));
            this.utils.setText("tc-bit-padding-count", this.utils.formatBits(diagnostics.padding_bits));
            this.utils.setText("tc-bit-total-bytes", this.utils.formatBytes(diagnostics.total_bytes));
            this.renderBeforeAfterBits(diagnostics, bits);
            root.innerHTML = html;
            this.attachBitstreamEvents(root);

            if (more) {
                more.hidden = diagnostics.preview_bits.length <= 256;
                more.textContent = this.bitstreamExpanded ? "Show less" : "Show more";
            }
        },

        renderBeforeAfterBits(diagnostics, huffmanBits) {
            const ascii = this.utils.byId("tc-ascii-preview");
            const huffman = this.utils.byId("tc-huffman-preview");
            if (ascii) ascii.innerHTML = this.renderCompactBits(diagnostics.ascii_preview_bits || "", "tc-fixed-bit");
            if (huffman) huffman.innerHTML = this.renderCompactBits(huffmanBits || "", "tc-huffman-bit");
        },

        renderCompactBits(bits, className) {
            if (!bits) return "No preview.";
            const chunks = [];
            for (let index = 0; index < Math.min(bits.length, 96); index += 8) {
                chunks.push(`<span class="tc-mini-byte ${this.utils.escapeHtml(className)}">${this.utils.escapeHtml(bits.slice(index, index + 8))}</span>`);
            }
            return chunks.join("");
        },

        renderByteGroups(bits, options) {
            const settings = options || {};
            const diagnostics = settings.diagnostics || {};
            const chunks = [];
            const visibleDataBits = Number(diagnostics.visible_data_bits || bits.length);

            for (let offset = 0; offset < bits.length; offset += 8) {
                const byteBits = bits.slice(offset, offset + 8);
                const bitHtml = byteBits.split("").map((bit, bitOffset) => {
                    const bitIndex = offset + bitOffset + (settings.dataOffset || 0);
                    const mapping = diagnostics.bit_to_symbol ? diagnostics.bit_to_symbol[String(bitIndex)] : null;
                    const classes = [settings.className || "tc-bitstream-bit"];

                    if (diagnostics.visible_padding_bits && bitIndex >= visibleDataBits) {
                        classes.push("is-padding");
                    }

                    return [
                        `<span class="${this.utils.escapeHtml(classes.join(" "))}"`,
                        mapping ? ` data-bit-index="${bitIndex}" data-code="${this.utils.escapeHtml(mapping.code)}" data-byte="${this.utils.escapeHtml(mapping.byte)}" data-symbol="${this.utils.escapeHtml(mapping.symbol)}" data-start="${this.utils.escapeHtml(mapping.start)}"` : "",
                        ">",
                        this.utils.escapeHtml(bit),
                        "</span>"
                    ].join("");
                }).join("");

                chunks.push(`<span class="tc-byte-container tc-bitstream-chunk">${bitHtml}</span>`);
            }

            return chunks.join("");
        },

        attachBitstreamEvents(root) {
            const tooltip = this.ensureBitTooltip();
            root.querySelectorAll("[data-code]").forEach((bit) => {
                bit.addEventListener("mouseenter", (event) => {
                    const target = event.currentTarget;
                    const code = target.getAttribute("data-code");
                    const byteValue = target.getAttribute("data-byte");
                    const symbol = target.getAttribute("data-symbol");
                    const start = target.getAttribute("data-start");
                    this.highlightBitMapping(code, byteValue, start);
                    tooltip.textContent = `Symbol: "${symbol}" | Code: "${code}" | Bits: ${code.length}`;
                    tooltip.hidden = false;
                });

                bit.addEventListener("mousemove", (event) => {
                    tooltip.style.left = `${event.clientX + 14}px`;
                    tooltip.style.top = `${event.clientY + 14}px`;
                });

                bit.addEventListener("mouseleave", () => {
                    this.clearBitMapping();
                    tooltip.hidden = true;
                });
            });
        },

        ensureBitTooltip() {
            let tooltip = this.utils.byId("tc-bit-tooltip");
            if (tooltip) return tooltip;
            tooltip = document.createElement("div");
            tooltip.id = "tc-bit-tooltip";
            tooltip.className = "tc-bit-tooltip";
            tooltip.hidden = true;
            document.body.appendChild(tooltip);
            return tooltip;
        },

        ensureMetricModal() {
            return this.inspector.ensureMetricModal(this);
        },

        openInspector(key, stats) {
            this.inspector.openInspector(this, key, stats);
        },

        renderMetricModal(key, stats) {
            this.inspector.renderMetricModal(this, key, stats);
        },

        base64ToBlob(base64) {
            const binary = window.atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            return new Blob([bytes], { type: "application/octet-stream" });
        },

        resetDownload() {
            if (this.downloadUrl) {
                URL.revokeObjectURL(this.downloadUrl);
                this.downloadUrl = null;
            }

            const link = this.utils.byId("tc-download");
            if (link) {
                link.href = "#";
                link.removeAttribute("download");
                link.classList.add("is-disabled");
                link.setAttribute("aria-disabled", "true");
            }
        },

        updateDownload(payload) {
            this.resetDownload();
            const link = this.utils.byId("tc-download");
            if (!link || !payload.compressed_file_base64) return;

            this.downloadUrl = URL.createObjectURL(this.base64ToBlob(payload.compressed_file_base64));
            link.href = this.downloadUrl;
            link.download = payload.compressed_filename || "compressed.huff";
            link.classList.remove("is-disabled");
            link.setAttribute("aria-disabled", "false");
        },

        getVisibleTree() {
            return this.payload ? (this.payload.visual_tree_data || this.payload.tree_data) : null;
        },

        countNodes(node) {
            if (!node) return 0;
            return 1 + (node.children || []).reduce((total, child) => total + this.countNodes(child), 0);
        },

        pruneTree(node, shouldPrune, depth) {
            if (!node) return null;
            const copy = {
                id: node.id,
                label: node.label,
                frequency: node.frequency,
                type: node.type,
                edge: node.edge
            };

            if (shouldPrune && depth >= this.PRUNE_DEPTH && node.children && node.children.length) {
                copy.children = [{
                    id: `${node.id}-pruned`,
                    label: "...",
                    frequency: node.frequency,
                    type: "leaf",
                    edge: "*"
                }];
                return copy;
            }

            if (node.children && node.children.length) {
                copy.children = node.children.map((child) => this.pruneTree(child, shouldPrune, depth + 1));
            }

            return copy;
        },

        renderState() {
            const svgElement = this.utils.byId("tc-tree-svg");
            const host = this.getTreeHost();
            if (!svgElement || !host || !window.d3) return;

            const svg = d3.select(svgElement);
            svg.selectAll("*").remove();

            const width = Math.max(640, host.clientWidth || 640);
            const height = Math.max(420, host.clientHeight || 420);
            svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

            const treeData = this.getVisibleTree();
            if (!treeData) {
                svg.append("text")
                    .attr("class", "tc-tree-empty")
                    .attr("x", width / 2)
                    .attr("y", height / 2)
                    .attr("text-anchor", "middle")
                    .text("Compress a file to render its Huffman tree.");
                return;
            }

            const shouldPrune = this.countNodes(treeData) > this.PRUNE_NODE_THRESHOLD;
            const visibleTree = this.pruneTree(treeData, shouldPrune, 0);
            const root = d3.hierarchy(visibleTree);
            const highlightedPath = {};
            if (this.highlightedCode) {
                this.findPathForCode(visibleTree, this.highlightedCode).forEach((id) => {
                    highlightedPath[id] = true;
                });
            }
            const treeLayout = d3.tree().nodeSize([54, 96]);
            treeLayout(root);

            const nodes = root.descendants();
            const links = root.links();
            const minX = d3.min(nodes, (node) => node.x) || 0;
            const maxX = d3.max(nodes, (node) => node.x) || 0;
            const minY = d3.min(nodes, (node) => node.y) || 0;
            const offsetX = (width - (maxX - minX)) / 2 - minX;
            const offsetY = 42 - minY;

            const layer = svg.append("g").attr("class", "tc-tree-layer");
            const zoom = d3.zoom()
                .scaleExtent([0.25, 4])
                .on("zoom", () => {
                    layer.attr("transform", d3.event.transform);
                });
            svg.call(zoom);

            layer.selectAll(".tc-tree-link")
                .data(links)
                .enter()
                .append("path")
                .attr("class", (link) => highlightedPath[link.source.data.id] && highlightedPath[link.target.data.id] ? "tc-tree-link is-active" : "tc-tree-link")
                .attr("d", (link) => {
                    const sourceX = link.source.x + offsetX;
                    const sourceY = link.source.y + offsetY;
                    const targetX = link.target.x + offsetX;
                    const targetY = link.target.y + offsetY;
                    const midY = (sourceY + targetY) / 2;
                    return `M${sourceX},${sourceY}C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;
                });

            layer.selectAll(".tc-tree-edge-label")
                .data(links)
                .enter()
                .append("text")
                .attr("class", "tc-tree-edge-label")
                .attr("x", (link) => (link.source.x + link.target.x) / 2 + offsetX)
                .attr("y", (link) => (link.source.y + link.target.y) / 2 + offsetY - 8)
                .attr("text-anchor", "middle")
                .text((link) => link.target.data.edge || "");

            const node = layer.selectAll(".tc-tree-node")
                .data(nodes)
                .enter()
                .append("g")
                .attr("class", (datum) => `tc-tree-node ${datum.data.type === "internal" ? "is-internal" : "is-leaf"}${highlightedPath[datum.data.id] ? " is-active" : ""}`)
                .attr("transform", (datum) => `translate(${datum.x + offsetX},${datum.y + offsetY})`);

            node.append("circle").attr("r", 20);
            node.append("text")
                .attr("class", "tc-tree-node-label")
                .attr("y", 4)
                .attr("text-anchor", "middle")
                .text((datum) => datum.data.type === "internal" ? datum.data.frequency : datum.data.label);
        },

        findPathForCode(treeData, code) {
            const path = [];
            let node = treeData;
            if (!node) return path;
            path.push(node.id);

            for (let index = 0; index < code.length; index += 1) {
                const edge = code[index];
                const next = (node.children || []).filter((child) => child.edge === edge)[0];
                if (!next) return [];
                node = next;
                path.push(node.id);
            }

            return path;
        },

        highlightBitMapping(code, byteValue, start) {
            this.highlightedCode = code;
            this.highlightedByte = byteValue;

            document.querySelectorAll(".tc-bitstream-bit.is-active").forEach((bit) => bit.classList.remove("is-active"));
            document.querySelectorAll(`.tc-bitstream-bit[data-start="${start}"]`).forEach((bit) => bit.classList.add("is-active"));
            document.querySelectorAll("[data-tc-code-byte]").forEach((row) => {
                row.classList.toggle("is-linked", row.getAttribute("data-tc-code-byte") === String(byteValue));
            });

            this.renderState();
        },

        highlightSymbolBits(byteValue, code) {
            this.highlightedCode = code;
            this.highlightedByte = byteValue;

            document.querySelectorAll(".tc-bitstream-bit.is-active").forEach((bit) => bit.classList.remove("is-active"));
            document.querySelectorAll(`.tc-bitstream-bit[data-byte="${String(byteValue)}"]`).forEach((bit) => bit.classList.add("is-active"));
            this.renderState();
        },

        clearBitMapping() {
            this.highlightedCode = null;
            this.highlightedByte = null;
            document.querySelectorAll(".tc-bitstream-bit.is-active").forEach((bit) => bit.classList.remove("is-active"));
            document.querySelectorAll("[data-tc-code-byte].is-linked").forEach((row) => row.classList.remove("is-linked"));
            this.renderState();
        }
    };

    window.IDE_COMPRESSOR = IDE_COMPRESSOR;
    document.addEventListener("DOMContentLoaded", () => {
        IDE_COMPRESSOR.init();
    });
})();
