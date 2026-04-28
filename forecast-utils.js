(function () {
    const RISK_META = {
        1: { short: 'VLOW', label: '1 Very Low', title: 'Very Low', color: '#c29f92', description: 'A few weak or short-lived thunderstorms are possible.' },
        2: { short: 'LOW', label: '2 Low', title: 'Low', color: '#00aeef', description: 'Isolated thunderstorms are possible.' },
        3: { short: 'SLGT', label: '3 Slight', title: 'Slight', color: '#5da848', description: 'Scattered thunderstorms are possible.' },
        4: { short: 'MDT', label: '4 Moderate', title: 'Moderate', color: '#f7941d', description: 'More widespread thunderstorms are likely, with severe pockets possible.' },
        5: { short: 'HIGH', label: '5 High', title: 'High', color: '#da2128', description: 'Severe thunderstorms are likely across a broader area.' },
        6: { short: 'SVR', label: '6 Severe', title: 'Severe', color: '#800080', description: 'Severe-weather criteria are expected to be met.' }
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function parseRiskRank(input) {
        if (typeof input === 'number' && Number.isFinite(input)) return input;
        if (typeof input === 'string') {
            const match = input.match(/\d+/);
            if (match) return parseInt(match[0], 10);
            if (input.toUpperCase().includes('SEVERE')) return 6;
            if (input.toUpperCase().includes('HIGH')) return 5;
            if (input.toUpperCase().includes('MODERATE')) return 4;
            if (input.toUpperCase().includes('SLIGHT')) return 3;
            if (input.toUpperCase().includes('LOW')) return 2;
        }
        return 0;
    }

    function getRiskMeta(rankOrLabel) {
        const rank = parseRiskRank(rankOrLabel);
        return RISK_META[rank] || {
            short: 'RISK',
            label: 'Outlook',
            title: 'Outlook',
            color: '#94a3b8',
            description: 'Thunderstorm outlook information.'
        };
    }

    function getFeatureRank(feature) {
        if (!feature || !feature.properties) return 0;
        return parseRiskRank(
            feature.properties.rank ??
            feature.properties.user_rank ??
            feature.properties.risk ??
            feature.properties.user_risk
        );
    }

    function getFeatureColor(feature) {
        if (!feature || !feature.properties) return '#94a3b8';
        return feature.properties.color || feature.properties.user_color || getRiskMeta(getFeatureRank(feature)).color;
    }

    function getFeatureLabel(feature) {
        if (!feature || !feature.properties) return 'Outlook';
        return feature.properties.risk || feature.properties.user_risk || getRiskMeta(getFeatureRank(feature)).label;
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
        if (!Array.isArray(features) || !window.turf) return Array.isArray(features) ? clone(features) : [];

        const groups = new Map();

        features.forEach(function (feature) {
            if (!feature || !feature.geometry) return;
            if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return;

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
                part.properties = {
                    rank: group.rank,
                    color: group.color,
                    risk: group.label,
                    displayId: group.rank + '-' + index
                };
                displayFeatures.push(part);
            });

            coverageMask = unionTwo(coverageMask, unioned);
        });

        return displayFeatures.sort(function (a, b) {
            return getFeatureRank(a) - getFeatureRank(b);
        });
    }

    function getTopRiskFeatureAtLngLat(lngLat, features) {
        if (!window.turf || !Array.isArray(features)) return null;

        const point = turf.point(Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat]);
        let bestFeature = null;

        features.forEach(function (feature) {
            if (!feature || !feature.geometry) return;
            if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return;

            try {
                if (turf.booleanPointInPolygon(point, feature)) {
                    if (!bestFeature || getFeatureRank(feature) > getFeatureRank(bestFeature)) {
                        bestFeature = feature;
                    }
                }
            } catch (error) {
                console.warn('Point test failed for forecast geometry.', error);
            }
        });

        return bestFeature ? clone(bestFeature) : null;
    }

    function summarizeRiskLevels(features) {
        const seen = new Map();

        (features || []).forEach(function (feature) {
            const rank = getFeatureRank(feature);
            if (!rank || seen.has(rank)) return;
            seen.set(rank, getRiskMeta(rank));
        });

        return Array.from(seen.entries())
            .sort(function (a, b) { return a[0] - b[0]; })
            .map(function (entry) { return Object.assign({ rank: entry[0] }, entry[1]); });
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
        clone: clone,
        getRiskMeta: getRiskMeta,
        getFeatureRank: getFeatureRank,
        getFeatureColor: getFeatureColor,
        getFeatureLabel: getFeatureLabel,
        normalizeDisplayFeatures: normalizeDisplayFeatures,
        getTopRiskFeatureAtLngLat: getTopRiskFeatureAtLngLat,
        summarizeRiskLevels: summarizeRiskLevels,
        formatUtc: formatUtc,
        wrapCanvasText: wrapCanvasText,
        slugify: slugify
    };
})();
