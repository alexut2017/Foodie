// Sample partner listings (same as the website) until real partners sign.
export type District = { id: string; name: string; lat: number; lng: number; live: boolean };
export type Restaurant = {
  id: string; name: string; district: string; cuisine: string; desc: string; offer: string;
  pickup: boolean; isNew: boolean; founding: boolean; price: number; lat: number; lng: number;
};

export const DISTRICTS: District[] = [
  { id: 'rice', name: 'Rice Village / West U', lat: 29.7174, lng: -95.4153, live: true },
  { id: 'montrose', name: 'Montrose', lat: 29.7454, lng: -95.3909, live: true },
  { id: 'heights', name: 'The Heights', lat: 29.798, lng: -95.398, live: true },
  { id: 'downtown', name: 'Midtown · Downtown · EaDo', lat: 29.752, lng: -95.365, live: true },
  { id: 'tmc', name: 'Medical Center / Museum District', lat: 29.714, lng: -95.396, live: true },
  { id: 'bellaire', name: 'Bellaire Blvd / Chinatown', lat: 29.7058, lng: -95.545, live: true },
];

const OFFERS: Record<string, string> = {
  ten: '10% off food · Sun–Thu',
  fifteen: '15% off food · Mon–Thu',
  app: 'Free appetizer with 2 entrées · Sun–Thu',
  dessert: 'Free dessert with 2 entrées · Daily',
  drink: 'Free drink or pastry with purchase · Daily',
};

// [name, district, cuisine, description, offer, pickup, isNew, founding, price, dLat, dLng]
type Row = [string, string, string, string, string, boolean, boolean, boolean, number, number, number];
const R: Row[] = [
  ['Juniper Table', 'rice', 'Mediterranean', 'Mezze plates, wood-grilled kebabs and big shared salads.', 'ten', true, false, true, 2, 0.002, -0.003],
  ['Kiko Ramen House', 'rice', 'Japanese', 'Rich tonkotsu and miso bowls, gyoza and rice plates.', 'fifteen', true, true, false, 2, -0.002, 0.002],
  ['Bluebonnet Bakeshop', 'rice', 'Bakery & café', 'Morning pastries, kolaches and pour-over coffee.', 'drink', true, false, true, 1, 0.001, 0.004],
  ['Rio Verde Cantina', 'rice', 'Tex-Mex', 'Fajitas, queso and enchiladas on a shaded patio.', 'app', false, false, false, 2, -0.003, -0.001],
  ['Marigold Thai Kitchen', 'montrose', 'Thai', 'Curries, khao soi and wok-fired noodles.', 'ten', true, false, true, 2, 0.002, 0.002],
  ['The Copper Pot', 'montrose', 'American', 'Neighborhood bistro: burgers, roast chicken, seasonal sides.', 'fifteen', false, true, false, 3, -0.002, -0.003],
  ['Little Lagos', 'montrose', 'West African', 'Jollof, suya and slow-cooked stews.', 'app', true, true, false, 2, 0.003, -0.001],
  ['Westheimer Noodle Co.', 'montrose', 'Vietnamese', 'Pho, vermicelli bowls and crispy egg rolls.', 'ten', true, false, false, 1, -0.001, 0.004],
  ['Studio Smokehouse', 'heights', 'BBQ', 'Post-oak brisket, ribs and scratch sides.', 'ten', true, false, true, 2, 0.002, 0.003],
  ['Ivy & Oak Trattoria', 'heights', 'Italian', 'Hand-rolled pasta, wood-fired pizza and antipasti.', 'app', false, false, true, 3, -0.003, -0.002],
  ['Porch Light Coffee', 'heights', 'Bakery & café', 'Espresso, breakfast tacos and laptop-friendly tables.', 'drink', true, true, false, 1, 0.001, -0.004],
  ['Bayou Biscuit Co.', 'heights', 'Southern', 'Brunch all day: biscuits, gravy and fried chicken.', 'fifteen', false, false, false, 2, -0.001, 0.001],
  ['Main Street Dumpling Bar', 'downtown', 'Chinese', 'Soup dumplings, scallion pancakes and noodles.', 'ten', true, true, false, 2, 0.004, -0.004],
  ['Eastwood Taqueria', 'downtown', 'Mexican', 'Al pastor, barbacoa and handmade tortillas.', 'fifteen', true, false, true, 1, -0.002, 0.012],
  ['Market Square Pizza Co.', 'downtown', 'Pizza', 'New York–style slices and whole pies.', 'ten', true, false, false, 1, 0.006, 0.004],
  ['Gulf & Grain', 'downtown', 'Seafood', 'Gulf oysters, redfish and grain bowls.', 'app', false, false, false, 3, -0.006, -0.006],
  ['Museum Mile Kitchen', 'tmc', 'Healthy', 'Grain bowls, wraps and fresh juices near the museums.', 'fifteen', true, false, true, 1, 0.003, 0.004],
  ['Almeda Curry House', 'tmc', 'Indian', 'Biryani, tikka and weekday lunch thalis.', 'ten', true, true, false, 2, -0.004, 0.006],
  ['Fannin Street Deli', 'tmc', 'Deli', 'Stacked sandwiches and soups for the after-shift crowd.', 'drink', true, false, false, 1, -0.002, -0.002],
  ['Third Ward Wing Shop', 'tmc', 'Wings', 'Lemon-pepper, honey-hot and dry-rub wings.', 'ten', true, false, false, 1, 0.004, 0.012],
  ['Lotus Lane Dim Sum', 'bellaire', 'Chinese', 'Cart-style dim sum and Cantonese roast meats.', 'app', true, false, true, 2, 0.002, 0.004],
  ['Spoon & Seoul', 'bellaire', 'Korean', 'Tableside barbecue, stews and banchan.', 'dessert', false, true, false, 3, -0.002, -0.004],
  ['Bayou Banh Mi', 'bellaire', 'Vietnamese', 'Banh mi, rice plates and Vietnamese coffee.', 'drink', true, false, false, 1, 0.003, -0.002],
  ['Kesar Grill', 'bellaire', 'Pakistani', 'Charcoal kebabs, karahi and fresh naan.', 'fifteen', true, false, false, 2, -0.003, 0.002],
];

const D: Record<string, District> = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
export const districtName = (id: string) => D[id]?.name ?? '';

// Same ids as the website ('r0', 'r1', ...) so visits line up across web and app.
export const RESTAURANTS: Restaurant[] = R.map((r, i) => ({
  id: 'r' + i, name: r[0], district: r[1], cuisine: r[2], desc: r[3], offer: OFFERS[r[4]],
  pickup: r[5], isNew: r[6], founding: r[7], price: r[8], lat: D[r[1]].lat + r[9], lng: D[r[1]].lng + r[10],
}));

export const findRestaurant = (id: string) => RESTAURANTS.find((r) => r.id === id);
