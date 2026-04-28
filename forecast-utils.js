(function () {
    const RISK_META = {
        1: { short: 'LOW', label: '1 Low', title: 'Low', color: '#67c6ac', description: 'Isolated thunderstorms possible.' },
        2: { short: 'SLGT', label: '2 Slight', title: 'Slight', color: '#ffea00', description: 'Scattered thunderstorms possible.' },
        3: { short: 'ENH', label: '3 Enhanced', title: 'Enhanced', color: '#ff7a21', description: 'Numerous thunderstorms possible, locally severe.' },
        4: { short: 'MDT', label: '4 Moderate', title: 'Moderate', color: '#f91522', description: 'Widespread thunderstorms likely, perhaps turning severe in places.' },
        5: { short: 'HIGH', label: '5 High', title: 'High', color: '#b23cc7', description: 'Severe thunderstorms likely.' }
    };
    const SEVERE_META = {
        short: 'SEV',
        label: 'SEVERE',
        title: 'Severe',
        color: '#111111',
        description: 'Black outline represents severe weather possible.'
    };
    const HOCO_LIGHTNING_COLORS = [
        "#ffffff", "#d0cece", "#d0cece", "#d0cece", "#d0cece", "#bea497", "#bea497", "#bea497", "#bea497", "#bea497",
        "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4",
        "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4", "#66c2a4",
        "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200",
        "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200", "#fff200",
        "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27",
        "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27", "#ff7f27",
        "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24",
        "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#ec1c24", "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba",
        "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba", "#b83dba"
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function isSevereLabel(input) {
        return typeof input === 'string' && input.toUpperCase().includes('SEVERE');
    }

    function parseRiskRank(input) {
        if (typeof input === 'number' && Number.isFinite(input)) {
            return input === 6 ? 0 : Math.max(0, Math.min(5, input));
        }
        if (typeof input === 'string') {
            const normalized = input.toUpperCase();
            if (normalized.includes('SEVERE')) return 0;
            if (normalized.includes('HIGH')) return 5;
            if (normalized.includes('MODERATE')) return 4;
            if (normalized.includes('ENHANCED')) return 3;
            if (normalized.includes('SLIGHT')) return 2;
            if (normalized.includes('LOW')) return 1;
            const match = normalized.match(/\d+/);
            if (match) {
                const parsed = parseInt(match[0], 10);
                return parsed === 6 ? 0 : Math.max(0, Math.min(5, parsed));
            }
        }
        return 0;
    }

    function getRiskMeta(rankOrLabel) {
        if (rankOrLabel === 6 || isSevereLabel(rankOrLabel)) return SEVERE_META;
        const rank = parseRiskRank(rankOrLabel);
        return RISK_META[rank] || {
            short: 'RISK',
            label: 'Outlook',
            title: 'Outlook',
            color: '#94a3b8',
            description: 'Thunderstorm outlook information.'
        };
    }

    function isSevereFeature(feature) {
        if (!feature || !feature.properties) return false;
        const properties = feature.properties;
        return Boolean(
            properties.isSevere ||
            properties.severe ||
            properties.user_severe ||
            isSevereLabel(properties.risk) ||
            isSevereLabel(properties.user_risk) ||
            Number(properties.rank) === 6 ||
            Number(properties.user_rank) === 6
        );
    }

    function getFeatureRank(feature) {
        if (!feature || !feature.properties) return 0;
        if (isSevereFeature(feature)) {
            return parseRiskRank(
                feature.properties.baseRisk ??
                feature.properties.base_rank ??
                feature.properties.parentRisk ??
                0
            );
        }
        return parseRiskRank(
            feature.properties.risk ??
            feature.properties.user_risk ??
            feature.properties.rank ??
            feature.properties.user_rank
        );
    }

    function getFeatureMeta(feature) {
        return isSevereFeature(feature) ? SEVERE_META : getRiskMeta(getFeatureRank(feature));
    }

    function getFeatureColor(feature) {
        return getFeatureMeta(feature).color;
    }

    function getFeatureLabel(feature) {
        return getFeatureMeta(feature).label;
    }

    function decorateDisplayFeature(feature, index) {
        if (!feature || !feature.geometry) return null;
        const severe = isSevereFeature(feature);
        const meta = severe ? SEVERE_META : getRiskMeta(getFeatureRank(feature));
        const displayId = severe ? 'severe-' + index : (getFeatureRank(feature) + '-' + index);

        return {
            type: 'Feature',
            geometry: clone(feature.geometry),
            properties: {
                rank: severe ? 0 : getFeatureRank(feature),
                color: meta.color,
                risk: meta.label,
                short: meta.short,
                isSevere: severe,
                severe: severe,
                displayId: displayId,
                fill: severe ? 'rgba(0, 0, 0, 0)' : meta.color,
                'fill-opacity': severe ? 0 : 0.36,
                stroke: meta.color,
                'stroke-width': severe ? 3 : 2
            }
        };
    }

    function flattenFeature(feature) {
        if (!feature || !window.turf) return [];
        const flattened = [];
        turf.flattenEach(feature, function (current) {
            flattened.push(clone(current));
        });
        return flattened;
    }

    function unionTwo(featureA, featureB) {
        if (!featureA) return featureB ? clone(featureB) : null;
        if (!featureB) return clone(featureA);

        try {
            return turf.union(featureA, featureB) || clone(featureA);
        } catch (error) {
            console.warn('Union failed for forecast geometry.', error);
            return clone(featureA);
        }
    }

    function unionMany(features) {
        let unioned = null;
        const parts = [];

        features.forEach(function (feature) {
            parts.push.apply(parts, flattenFeature(feature));
        });

        parts.forEach(function (part) {
            unioned = unioned ? unionTwo(unioned, part) : clone(part);
        });

        return unioned;
    }

    function subtractMask(feature, mask) {
        if (!feature) return null;
        if (!mask) return clone(feature);

        try {
            return turf.difference(feature, mask) || null;
        } catch (error) {
            console.warn('Difference failed for forecast geometry.', error);
            return clone(feature);
        }
    }

    function normalizeDisplayFeatures(features) {
        if (!Array.isArray(features)) return [];
        if (!window.turf) {
            return features
                .map(function (feature, index) { return decorateDisplayFeature(feature, index); })
                .filter(Boolean);
        }

        const groups = new Map();
        const severeFeatures = [];

        features.forEach(function (feature) {
            if (!feature || !feature.geometry) return;
            if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return;
            if (isSevereFeature(feature)) {
                severeFeatures.push(clone(feature));
                return;
            }

            const rank = getFeatureRank(feature);
            const color = getFeatureColor(feature);
            const label = getFeatureLabel(feature);
            const key = [rank, color, label].join('|');

            if (!groups.has(key)) {
                groups.set(key, {
                    rank: rank,
                    color: color,
                    label: label,
                    features: []
                });
            }

            groups.get(key).features.push(clone(feature));
        });

        const sortedGroups = Array.from(groups.values()).sort(function (a, b) {
            return b.rank - a.rank;
        });

        let coverageMask = null;
        const displayFeatures = [];

        sortedGroups.forEach(function (group) {
            const unioned = unionMany(group.features);
            if (!unioned) return;

            const visible = subtractMask(unioned, coverageMask);
            flattenFeature(visible).forEach(function (part, index) {
                const decorated = decorateDisplayFeature({
                    geometry: part.geometry,
                    properties: {
                        rank: group.rank,
                        color: group.color,
                        risk: group.label
                    }
                }, index);
                if (decorated) {
                    displayFeatures.push(decorated);
                }
            });

            coverageMask = unionTwo(coverageMask, unioned);
        });

        severeFeatures.forEach(function (feature, index) {
            const decorated = decorateDisplayFeature(feature, index);
            if (decorated) {
                displayFeatures.push(decorated);
            }
        });

        return displayFeatures.sort(function (a, b) {
            return Number(Boolean(a?.properties?.isSevere)) - Number(Boolean(b?.properties?.isSevere)) ||
                getFeatureRank(a) - getFeatureRank(b);
        });
    }

    function getTopRiskFeatureAtLngLat(lngLat, features) {
        if (!window.turf || !Array.isArray(features)) return null;

        const point = turf.point(Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat]);
        let bestFeature = null;
        let severeFeature = null;

        features.forEach(function (feature) {
            if (!feature || !feature.geometry) return;
            if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return;

            try {
                if (turf.booleanPointInPolygon(point, feature)) {
                    if (isSevereFeature(feature)) {
                        severeFeature = severeFeature || feature;
                        return;
                    }
                    if (!bestFeature || getFeatureRank(feature) > getFeatureRank(bestFeature)) {
                        bestFeature = feature;
                    }
                }
            } catch (error) {
                console.warn('Point test failed for forecast geometry.', error);
            }
        });

        const selected = bestFeature || severeFeature;
        if (!selected) return null;
        const output = clone(selected);
        const meta = getFeatureMeta(output);
        output.properties = Object.assign({}, output.properties, {
            rank: getFeatureRank(output),
            color: meta.color,
            risk: meta.label,
            isSevere: isSevereFeature(output)
        });
        return output;
    }

    function summarizeRiskLevels(features) {
        const seen = new Map();

        (features || []).forEach(function (feature) {
            if (isSevereFeature(feature)) return;
            const rank = getFeatureRank(feature);
            if (!rank || seen.has(rank)) return;
            seen.set(rank, getRiskMeta(rank));
        });

        return Array.from(seen.entries())
            .sort(function (a, b) { return a[0] - b[0]; })
            .map(function (entry) { return Object.assign({ rank: entry[0] }, entry[1]); });
    }

    function summarizeAllRiskLevels(features) {
        const issuedRanks = new Set(
            (features || [])
                .filter(function (feature) { return !isSevereFeature(feature); })
                .map(function (feature) { return getFeatureRank(feature); })
                .filter(Boolean)
        );

        return Object.keys(RISK_META)
            .map(function (rankKey) {
                const rank = parseInt(rankKey, 10);
                return Object.assign({
                    rank: rank,
                    issued: issuedRanks.has(rank)
                }, RISK_META[rank]);
            })
            .sort(function (a, b) { return a.rank - b.rank; });
    }

    function validateRiskContainment(features) {
        if (!Array.isArray(features) || !window.turf) {
            return { valid: true, errors: [], warnings: [] };
        }

        const groupedByRank = new Map();

        features.forEach(function (feature) {
            if (!feature || !feature.geometry) return;
            if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return;
            if (isSevereFeature(feature)) return;

            const rank = getFeatureRank(feature);
            if (!rank) return;

            if (!groupedByRank.has(rank)) {
                groupedByRank.set(rank, []);
            }

            groupedByRank.get(rank).push(clone(feature));
        });

        const issuedRanks = Array.from(groupedByRank.keys()).sort(function (a, b) { return a - b; });
        if (issuedRanks.length < 2) {
            return { valid: true, errors: [], warnings: [] };
        }

        let lowerCoverage = unionMany(groupedByRank.get(issuedRanks[0]));
        const errors = [];

        for (let index = 1; index < issuedRanks.length; index += 1) {
            const rank = issuedRanks[index];
            const unioned = unionMany(groupedByRank.get(rank));
            if (!unioned) continue;

            const uncovered = subtractMask(unioned, lowerCoverage);
            if (uncovered) {
                const currentMeta = getRiskMeta(rank);
                const lowerMeta = getRiskMeta(issuedRanks[index - 1]);
                errors.push(
                    currentMeta.title + ' risk must be fully enclosed by the surrounding ' +
                    lowerMeta.title.toLowerCase() + ' or lower-risk area.'
                );
            }

            lowerCoverage = unionTwo(lowerCoverage, unioned);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: []
        };
    }

    function getForecastDayWindow(referenceValue, dayOffset) {
        var offset = Number(dayOffset || 0);
        var reference = referenceValue instanceof Date ? new Date(referenceValue.getTime()) : new Date(referenceValue || Date.now());
        if (Number.isNaN(reference.getTime())) {
            reference = new Date();
        }

        var start = new Date(reference.getTime());
        if (start.getHours() < 6 || (start.getHours() === 5 && start.getMinutes() <= 59)) {
            start.setDate(start.getDate() - 1);
        }

        start.setHours(6, 0, 0, 0);
        start.setDate(start.getDate() + offset);

        var end = new Date(start.getTime());
        end.setDate(end.getDate() + 1);
        end.setHours(5, 59, 59, 999);

        return {
            start: start,
            end: end,
            key: start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0'),
            offset: offset
        };
    }

    function getHocoLightningColor(value) {
        var numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) return HOCO_LIGHTNING_COLORS[0];
        var clamped = Math.max(0, Math.min(100, numeric));
        if (clamped <= 0) return HOCO_LIGHTNING_COLORS[0];
        var index = Math.min(HOCO_LIGHTNING_COLORS.length - 1, Math.max(0, Math.ceil(clamped) - 1));
        return HOCO_LIGHTNING_COLORS[index];
    }

    function getHocoLightningGradientStops() {
        var stops = [];
        var lastColor = null;

        HOCO_LIGHTNING_COLORS.forEach(function (color, index) {
            if (color !== lastColor) {
                stops.push({
                    value: index,
                    color: color
                });
                lastColor = color;
            }
        });

        if (!stops.length || stops[stops.length - 1].value !== 100) {
            stops.push({ value: 100, color: HOCO_LIGHTNING_COLORS[HOCO_LIGHTNING_COLORS.length - 1] });
        }

        return stops;
    }

    function parseRiskPercent(properties) {
        var source = properties || {};
        var rawValue = source.risk ?? source.risk_pct ?? source.prob ?? source.probability ?? source.percent ?? source.percentage;
        var risk = Number.parseFloat(rawValue);
        return Number.isFinite(risk) ? Math.max(0, Math.min(100, risk)) : 0;
    }

    function quantizeCoord(value) {
        return Number.parseFloat(Number(value).toFixed(4));
    }

    function computeRingCentroid(ring) {
        if (!Array.isArray(ring) || ring.length < 3) return null;

        var areaAcc = 0;
        var xAcc = 0;
        var yAcc = 0;

        for (var index = 0; index < ring.length - 1; index += 1) {
            var x1 = ring[index][0];
            var y1 = ring[index][1];
            var x2 = ring[index + 1][0];
            var y2 = ring[index + 1][1];
            var cross = (x1 * y2) - (x2 * y1);
            areaAcc += cross;
            xAcc += (x1 + x2) * cross;
            yAcc += (y1 + y2) * cross;
        }

        var area = areaAcc / 2;
        if (!Number.isFinite(area) || Math.abs(area) < 1e-9) {
            var lon = ring.reduce(function (sum, point) { return sum + point[0]; }, 0) / ring.length;
            var lat = ring.reduce(function (sum, point) { return sum + point[1]; }, 0) / ring.length;
            return [lon, lat];
        }

        return [xAcc / (6 * area), yAcc / (6 * area)];
    }

    function extractRiskPointsFromGeojson(geojsonData) {
        var features = Array.isArray(geojsonData && geojsonData.features) ? geojsonData.features : [];
        var pointFeatures = features.filter(function (feature) {
            return feature && feature.geometry && feature.geometry.type === 'Point' && parseRiskPercent(feature.properties) > 0;
        });

        if (pointFeatures.length) {
            return pointFeatures.map(function (feature) {
                return {
                    lon: quantizeCoord(feature.geometry.coordinates[0]),
                    lat: quantizeCoord(feature.geometry.coordinates[1]),
                    risk: parseRiskPercent(feature.properties)
                };
            });
        }

        return features.flatMap(function (feature) {
            var risk = parseRiskPercent(feature && feature.properties);
            if (risk <= 0) return [];

            if (feature && feature.geometry && feature.geometry.type === 'Polygon' && Array.isArray(feature.geometry.coordinates && feature.geometry.coordinates[0])) {
                var centroid = computeRingCentroid(feature.geometry.coordinates[0]);
                return centroid ? [{ lon: quantizeCoord(centroid[0]), lat: quantizeCoord(centroid[1]), risk: risk }] : [];
            }

            if (feature && feature.geometry && feature.geometry.type === 'MultiPolygon') {
                return feature.geometry.coordinates.flatMap(function (polygon) {
                    var centroid = computeRingCentroid((polygon && polygon[0]) || []);
                    return centroid ? [{ lon: quantizeCoord(centroid[0]), lat: quantizeCoord(centroid[1]), risk: risk }] : [];
                });
            }

            return [];
        });
    }

    function getMedian(values) {
        if (!values.length) return 0;
        var sorted = values.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function combineRiskPercentValues(values, weights, anomalyAware) {
        if (!values.length) return 0;
        if (values.length === 1) return Math.max(0, Math.min(100, values[0]));

        var weightedSum = 0;
        var weightTotal = 0;

        values.forEach(function (value, index) {
            var weight = Number.isFinite(weights[index]) ? weights[index] : 1;
            weightedSum += value * weight;
            weightTotal += weight;
        });

        var weightedMean = weightTotal ? weightedSum / weightTotal : 0;
        var median = getMedian(values);
        var latest = values[values.length - 1];
        var consensus = values.filter(function (value) { return value >= 20; }).length / values.length;
        var variance = values.reduce(function (sum, value) { return sum + Math.pow(value - weightedMean, 2); }, 0) / values.length;
        var spread = Math.sqrt(variance);

        var blended = (weightedMean * 0.68) + (median * 0.2) + (latest * 0.12);
        if (anomalyAware) {
            var trend = latest - median;
            var positiveBoost = Math.max(0, trend) * (0.16 + (consensus * 0.12));
            var disagreementPenalty = Math.max(0, spread - 16) * (1 - consensus) * 0.28;
            var downwardDrag = Math.max(0, median - latest) * 0.06;
            blended = blended + positiveBoost - disagreementPenalty - downwardDrag;
        }

        return Math.max(0, Math.min(100, blended));
    }

    function createMatrix(rows, cols, fill) {
        return Array.from({ length: rows }, function () { return Array(cols).fill(fill || 0); });
    }

    function applyMatrixSmoothing(matrix, passes) {
        var totalPasses = Number(passes || 1);
        var rows = matrix.length;
        var cols = matrix[0] ? matrix[0].length : 0;
        if (!rows || !cols) return matrix;

        var output = matrix.map(function (row) { return row.slice(); });
        var kernel = [
            [1, 2, 1],
            [2, 4, 2],
            [1, 2, 1]
        ];

        for (var pass = 0; pass < totalPasses; pass += 1) {
            var next = createMatrix(rows, cols, 0);
            for (var row = 0; row < rows; row += 1) {
                for (var col = 0; col < cols; col += 1) {
                    var weighted = 0;
                    var weightTotal = 0;
                    var activeWeight = 0;
                    for (var y = -1; y <= 1; y += 1) {
                        for (var x = -1; x <= 1; x += 1) {
                            var nRow = row + y;
                            var nCol = col + x;
                            if (nRow < 0 || nRow >= rows || nCol < 0 || nCol >= cols) continue;
                            var weight = kernel[y + 1][x + 1];
                            var value = output[nRow][nCol];
                            weighted += value * weight;
                            weightTotal += weight;
                            if (value > 0.1) activeWeight += weight;
                        }
                    }
                    next[row][col] = activeWeight < 4 ? output[row][col] * 0.6 : weighted / Math.max(weightTotal, 1);
                }
            }
            output = next;
        }

        return output;
    }

    function buildAxisEdges(values, descending) {
        var sorted = values.slice().sort(function (a, b) { return descending ? b - a : a - b; });
        if (!sorted.length) return [];
        if (sorted.length === 1) {
            var step = 0.1;
            return descending ? [sorted[0] + step, sorted[0] - step] : [sorted[0] - step, sorted[0] + step];
        }

        var edges = [];
        if (descending) {
            edges.push(sorted[0] + ((sorted[0] - sorted[1]) / 2));
            for (var descIndex = 1; descIndex < sorted.length; descIndex += 1) {
                edges.push((sorted[descIndex - 1] + sorted[descIndex]) / 2);
            }
            edges.push(sorted[sorted.length - 1] - ((sorted[sorted.length - 2] - sorted[sorted.length - 1]) / 2));
            return edges;
        }

        edges.push(sorted[0] - ((sorted[1] - sorted[0]) / 2));
        for (var ascIndex = 1; ascIndex < sorted.length; ascIndex += 1) {
            edges.push((sorted[ascIndex - 1] + sorted[ascIndex]) / 2);
        }
        edges.push(sorted[sorted.length - 1] + ((sorted[sorted.length - 1] - sorted[sorted.length - 2]) / 2));
        return edges;
    }

    function ringArea(ring) {
        var area = 0;
        for (var index = 0; index < ring.length - 1; index += 1) {
            area += (ring[index][0] * ring[index + 1][1]) - (ring[index + 1][0] * ring[index][1]);
        }
        return area / 2;
    }

    function scaleRingFromCentroid(ring, factor) {
        if (ring.length < 4 || factor === 1) return ring;
        var centroid = computeRingCentroid(ring);
        if (!centroid) return ring;

        var scaled = ring.slice(0, -1).map(function (point) {
            var nextLon = centroid[0] + ((point[0] - centroid[0]) * factor);
            var nextLat = centroid[1] + ((point[1] - centroid[1]) * factor);
            return [Number(nextLon.toFixed(5)), Number(nextLat.toFixed(5))];
        });
        scaled.push(scaled[0]);
        return scaled;
    }

    function smoothRing(ring, passes) {
        var totalPasses = Number(passes || 1);
        if (ring.length < 4) return ring;
        var current = ring.slice(0, -1);

        for (var pass = 0; pass < totalPasses; pass += 1) {
            var next = [];
            for (var index = 0; index < current.length; index += 1) {
                var pointA = current[index];
                var pointB = current[(index + 1) % current.length];
                next.push([
                    Number(((0.75 * pointA[0]) + (0.25 * pointB[0])).toFixed(5)),
                    Number(((0.75 * pointA[1]) + (0.25 * pointB[1])).toFixed(5))
                ]);
                next.push([
                    Number(((0.25 * pointA[0]) + (0.75 * pointB[0])).toFixed(5)),
                    Number(((0.25 * pointA[1]) + (0.75 * pointB[1])).toFixed(5))
                ]);
            }
            current = next;
        }

        current.push(current[0]);
        return current;
    }

    function simplifyRingByDistance(ring, minDistance) {
        if (ring.length < 4) return ring;
        var simplified = [ring[0]];
        for (var index = 1; index < ring.length - 1; index += 1) {
            var previous = simplified[simplified.length - 1];
            var current = ring[index];
            var distance = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
            if (distance >= minDistance) {
                simplified.push(current);
            }
        }

        var last = ring[ring.length - 1];
        if (simplified.length < 3) return ring;
        simplified.push(last);
        return simplified;
    }

    function pointKey(point) {
        return point[0].toFixed(6) + ',' + point[1].toFixed(6);
    }

    function assembleRingsFromEdges(edges) {
        var edgesByStart = new Map();
        var visited = new Set();

        edges.forEach(function (edge, index) {
            edge.id = index;
            edge.startKey = pointKey(edge.start);
            edge.endKey = pointKey(edge.end);
            if (!edgesByStart.has(edge.startKey)) {
                edgesByStart.set(edge.startKey, []);
            }
            edgesByStart.get(edge.startKey).push(edge);
        });

        var rings = [];
        for (var edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
            var edge = edges[edgeIndex];
            if (visited.has(edge.id)) continue;

            var ring = [edge.start];
            visited.add(edge.id);
            var current = edge;
            var guard = 0;

            while (guard < edges.length + 4) {
                ring.push(current.end);
                if (current.endKey === edge.startKey) break;
                var options = (edgesByStart.get(current.endKey) || []).filter(function (candidate) {
                    return !visited.has(candidate.id);
                });
                if (!options.length) break;
                current = options[0];
                visited.add(current.id);
                guard += 1;
            }

            if (ring.length >= 4 && pointKey(ring[0]) === pointKey(ring[ring.length - 1])) {
                rings.push(ring);
            }
        }

        return rings;
    }

    function getMaskComponents(mask) {
        var rows = mask.length;
        var cols = mask[0] ? mask[0].length : 0;
        var visited = createMatrix(rows, cols, false);
        var components = [];
        var directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (var row = 0; row < rows; row += 1) {
            for (var col = 0; col < cols; col += 1) {
                if (!mask[row][col] || visited[row][col]) continue;

                var queue = [[row, col]];
                var component = [];
                visited[row][col] = true;

                while (queue.length) {
                    var currentCell = queue.shift();
                    var currentRow = currentCell[0];
                    var currentCol = currentCell[1];
                    component.push([currentRow, currentCol]);

                    directions.forEach(function (direction) {
                        var nextRow = currentRow + direction[0];
                        var nextCol = currentCol + direction[1];
                        if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) return;
                        if (!mask[nextRow][nextCol] || visited[nextRow][nextCol]) return;
                        visited[nextRow][nextCol] = true;
                        queue.push([nextRow, nextCol]);
                    });
                }

                components.push(component);
            }
        }

        return components;
    }

    function buildComponentRings(component, lonEdges, latEdges, simplifyDistance, smoothingPasses) {
        var cellSet = new Set(component.map(function (cell) { return cell[0] + ',' + cell[1]; }));
        var edges = [];

        component.forEach(function (cell) {
            var row = cell[0];
            var col = cell[1];
            if (!cellSet.has((row - 1) + ',' + col)) {
                edges.push({ start: [lonEdges[col], latEdges[row]], end: [lonEdges[col + 1], latEdges[row]] });
            }
            if (!cellSet.has(row + ',' + (col + 1))) {
                edges.push({ start: [lonEdges[col + 1], latEdges[row]], end: [lonEdges[col + 1], latEdges[row + 1]] });
            }
            if (!cellSet.has((row + 1) + ',' + col)) {
                edges.push({ start: [lonEdges[col + 1], latEdges[row + 1]], end: [lonEdges[col], latEdges[row + 1]] });
            }
            if (!cellSet.has(row + ',' + (col - 1))) {
                edges.push({ start: [lonEdges[col], latEdges[row + 1]], end: [lonEdges[col], latEdges[row]] });
            }
        });

        return assembleRingsFromEdges(edges)
            .map(function (ring) { return smoothRing(ring, smoothingPasses); })
            .map(function (ring) { return simplifyRingByDistance(ring, simplifyDistance); })
            .filter(function (ring) { return ring.length >= 4 && Math.abs(ringArea(ring)) > 0.01; });
    }

    function buildClientEnsembleField(runEntries, options) {
        var config = options || {};
        var anomalyAware = config.anomalyAware !== false;
        var sortedEntries = runEntries.slice().sort(function (a, b) {
            var aTime = new Date(a.createdAt || a.issuedAt || 0).getTime();
            var bTime = new Date(b.createdAt || b.issuedAt || 0).getTime();
            return aTime - bTime;
        });

        var weights = sortedEntries.map(function (_, index) {
            return 1 + ((sortedEntries.length > 1 ? index / (sortedEntries.length - 1) : 0) * 0.4);
        });

        var coordLookup = new Map();
        var runRiskMaps = sortedEntries.map(function (entry) {
            var riskMap = new Map();
            extractRiskPointsFromGeojson(entry.geojson).forEach(function (point) {
                var key = quantizeCoord(point.lon) + ',' + quantizeCoord(point.lat);
                coordLookup.set(key, { lon: quantizeCoord(point.lon), lat: quantizeCoord(point.lat) });
                var existing = riskMap.get(key) || 0;
                if (point.risk > existing) {
                    riskMap.set(key, point.risk);
                }
            });
            return riskMap;
        });

        var coords = Array.from(coordLookup.values());
        if (!coords.length) {
            throw new Error('The selected AUTO-HOCO runs did not contain any usable risk points.');
        }

        var lonValues = Array.from(new Set(coords.map(function (coord) { return coord.lon; }))).sort(function (a, b) { return a - b; });
        var latValues = Array.from(new Set(coords.map(function (coord) { return coord.lat; }))).sort(function (a, b) { return b - a; });
        var lonIndex = new Map(lonValues.map(function (value, index) { return [value, index]; }));
        var latIndex = new Map(latValues.map(function (value, index) { return [value, index]; }));
        var matrix = createMatrix(latValues.length, lonValues.length, 0);

        coordLookup.forEach(function (coord, key) {
            var values = runRiskMaps.map(function (riskMap) { return riskMap.get(key) ?? 0; });
            var combinedRisk = combineRiskPercentValues(values, weights, anomalyAware);
            if (combinedRisk <= 0.5) return;
            var row = latIndex.get(coord.lat);
            var col = lonIndex.get(coord.lon);
            if (row === undefined || col === undefined) return;
            matrix[row][col] = combinedRisk;
        });

        var lonEdges = buildAxisEdges(lonValues, false);
        var latEdges = buildAxisEdges(latValues, true);
        var lonStep = lonValues.length > 1 ? Math.abs(lonValues[1] - lonValues[0]) : 0.15;
        var latStep = latValues.length > 1 ? Math.abs(latValues[0] - latValues[1]) : 0.15;

        return {
            matrix: matrix,
            lonEdges: lonEdges,
            latEdges: latEdges,
            simplifyDistance: Math.max(0.025, Math.min(0.1, Math.max(lonStep, latStep) * 0.85)),
            anomalyAware: anomalyAware
        };
    }

    function buildClientEnsembleGeojson(runEntries, options) {
        var config = options || {};
        var riskBands = config.riskBands || [
            { key: 'low', label: 'Low Risk', threshold: 5, representativeRisk: 15, fill: getHocoLightningColor(15), minCells: 10, scale: 1.06, smoothingPasses: 2 },
            { key: 'slight', label: 'Slight Risk', threshold: 20, representativeRisk: 30, fill: getHocoLightningColor(30), minCells: 8, scale: 1.04, smoothingPasses: 2 },
            { key: 'enhanced', label: 'Enhanced Risk', threshold: 40, representativeRisk: 50, fill: getHocoLightningColor(50), minCells: 6, scale: 1.03, smoothingPasses: 2 },
            { key: 'moderate', label: 'Moderate Risk', threshold: 60, representativeRisk: 68, fill: getHocoLightningColor(68), minCells: 5, scale: 1.02, smoothingPasses: 1 },
            { key: 'high', label: 'High Risk', threshold: 75, representativeRisk: 85, fill: getHocoLightningColor(85), minCells: 4, scale: 1.01, smoothingPasses: 1 }
        ];
        var field = buildClientEnsembleField(runEntries, config);
        var smoothedMatrix = applyMatrixSmoothing(field.matrix, config.noiseFilter === false ? 2 : 3);
        var features = [];

        riskBands.forEach(function (band) {
            var mask = smoothedMatrix.map(function (row) {
                return row.map(function (value) { return value >= band.threshold; });
            });
            var components = getMaskComponents(mask).filter(function (component) {
                return component.length >= band.minCells;
            });

            components.forEach(function (component) {
                var rings = buildComponentRings(component, field.lonEdges, field.latEdges, field.simplifyDistance, band.smoothingPasses)
                    .map(function (ring) { return scaleRingFromCentroid(ring, band.scale); })
                    .filter(function (ring) { return ring.length >= 4; });

                if (!rings.length) return;

                var peakRisk = component.reduce(function (peak, cell) {
                    return Math.max(peak, smoothedMatrix[cell[0]][cell[1]] || 0);
                }, 0);

                rings.forEach(function (ring) {
                    features.push({
                        type: 'Feature',
                        geometry: { type: 'Polygon', coordinates: [ring] },
                        properties: {
                            feature_type: 'polygon',
                            risk: band.representativeRisk,
                            peak_risk: Number(peakRisk.toFixed(1)),
                            risk_band: band.key,
                            label: band.label,
                            fill: band.fill,
                            color: band.fill,
                            'fill-opacity': 0.34,
                            stroke: band.fill,
                            'stroke-width': 1.5
                        }
                    });
                });
            });
        });

        features.sort(function (a, b) { return parseRiskPercent(a.properties) - parseRiskPercent(b.properties); });
        return { type: 'FeatureCollection', features: features };
    }

    function formatUtc(value) {
        const date = value instanceof Date ? value : new Date(value);
        return date.toLocaleString('en-GB', {
            timeZone: 'UTC',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(',', '') + ' UTC';
    }

    function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        let line = '';
        let lines = 0;

        if (!words.length) return y;

        for (let i = 0; i < words.length; i += 1) {
            const testLine = line ? line + ' ' + words[i] : words[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line) {
                ctx.fillText(line, x, y);
                y += lineHeight;
                lines += 1;
                line = words[i];

                if (maxLines && lines >= maxLines) {
                    ctx.fillText(line + '...', x, y);
                    return y + lineHeight;
                }
            } else {
                line = testLine;
            }
        }

        if (line) {
            ctx.fillText(line, x, y);
            y += lineHeight;
        }

        return y;
    }

    function slugify(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'forecast';
    }

    window.GenWeatherUtils = {
        RISK_META: RISK_META,
        SEVERE_META: SEVERE_META,
        HOCO_LIGHTNING_COLORS: HOCO_LIGHTNING_COLORS,
        clone: clone,
        getRiskMeta: getRiskMeta,
        getFeatureMeta: getFeatureMeta,
        getFeatureRank: getFeatureRank,
        getFeatureColor: getFeatureColor,
        getFeatureLabel: getFeatureLabel,
        isSevereFeature: isSevereFeature,
        normalizeDisplayFeatures: normalizeDisplayFeatures,
        getTopRiskFeatureAtLngLat: getTopRiskFeatureAtLngLat,
        summarizeRiskLevels: summarizeRiskLevels,
        summarizeAllRiskLevels: summarizeAllRiskLevels,
        validateRiskContainment: validateRiskContainment,
        getForecastDayWindow: getForecastDayWindow,
        getHocoLightningColor: getHocoLightningColor,
        getHocoLightningGradientStops: getHocoLightningGradientStops,
        parseRiskPercent: parseRiskPercent,
        buildClientEnsembleGeojson: buildClientEnsembleGeojson,
        formatUtc: formatUtc,
        wrapCanvasText: wrapCanvasText,
        slugify: slugify
    };
})();
