import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
let searchData = null;
export function loadSearchData() {
    if (searchData)
        return searchData;
    const keywordsPath = path.join(process.cwd(), 'src/data/keywords.csv');
    const locationsPath = path.join(process.cwd(), 'src/data/locations.csv');
    const keywordsFile = fs.readFileSync(keywordsPath, 'utf-8');
    const locationsFile = fs.readFileSync(locationsPath, 'utf-8');
    const keywordsData = parse(keywordsFile, {
        columns: true,
        skip_empty_lines: true,
    });
    const locationsData = parse(locationsFile, {
        columns: true,
        skip_empty_lines: true,
    });
    searchData = {
        keywords: keywordsData.map((row) => row.keyword),
        locations: locationsData.map((row) => ({
            location: row.location,
            county: row.county,
        })),
    };
    return searchData;
}
export function validateSearchTerm(term, type) {
    const data = loadSearchData();
    if (type === 'keyword') {
        return data.keywords.some((keyword) => keyword.toLowerCase() === term.toLowerCase());
    }
    else {
        return data.locations.some((loc) => loc.location.toLowerCase() === term.toLowerCase());
    }
}
export function searchKeywords(query) {
    const data = loadSearchData();
    const normalizedQuery = query.toLowerCase();
    return data.keywords.filter((keyword) => keyword.toLowerCase().includes(normalizedQuery));
}
export function searchLocations(query) {
    const data = loadSearchData();
    const normalizedQuery = query.toLowerCase();
    return data.locations.filter((location) => location.location.toLowerCase().includes(normalizedQuery) ||
        location.county.toLowerCase().includes(normalizedQuery));
}