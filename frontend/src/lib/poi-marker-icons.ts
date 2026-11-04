import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  AirplaneIcon,
  BabyIcon,
  BalloonIcon,
  BookOpenIcon,
  BooksIcon,
  BuildingIcon,
  BuildingsIcon,
  BusIcon,
  CastleTurretIcon,
  ChalkboardTeacherIcon,
  ChurchIcon,
  CoinsIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  DropIcon,
  EnvelopeIcon,
  FilmSlateIcon,
  FirstAidIcon,
  GlobeIcon,
  GraduationCapIcon,
  HandshakeIcon,
  HeartbeatIcon,
  HospitalIcon,
  IdentificationCardIcon,
  MapPinIcon,
  MaskHappyIcon,
  MoneyIcon,
  MoonStarsIcon,
  MusicNotesIcon,
  NetworkIcon,
  PaintBrushIcon,
  PaletteIcon,
  ParkIcon,
  PathIcon,
  PhoneIcon,
  PillIcon,
  ScalesIcon,
  ScrollIcon,
  ShieldIcon,
  ShoppingBagIcon,
  StorefrontIcon,
  TrashIcon,
  TreeEvergreenIcon,
  TreeIcon,
  SoccerBallIcon,
  StethoscopeIcon,
  BookIcon,
} from "@phosphor-icons/react/ssr";

const icons: Record<string, typeof MapPinIcon> = {
  book: BookOpenIcon,
  coins: CoinsIcon,
  "graduation-cap": GraduationCapIcon,
  hospital: StethoscopeIcon,
  landmark: BuildingsIcon,
  "map-pin": MapPinIcon,
  moon: MoonStarsIcon,
  phone: PhoneIcon,
  trees: TreeIcon,
  handshake: HandshakeIcon,
  "building-2": BuildingsIcon,
  building: BuildingIcon,
  "scroll-text": ScrollIcon,
  network: NetworkIcon,
  globe: GlobeIcon,
  scale: ScalesIcon,
  shield: ShieldIcon,
  banknote: MoneyIcon,
  "credit-card": CreditCardIcon,
  "tree-pine": TreeEvergreenIcon,
  "land-plot": ParkIcon,
  "bus-front": BusIcon,
  route: BusIcon,
  plane: AirplaneIcon,
  castle: CastleTurretIcon,
  "trash-2": TrashIcon,
  "id-card": IdentificationCardIcon,
  "ferris-wheel": BalloonIcon,
  trophy: SoccerBallIcon,
  clapperboard: FilmSlateIcon,
  drama: MaskHappyIcon,
  "music-2": MusicNotesIcon,
  store: StorefrontIcon,
  "shopping-bag": ShoppingBagIcon,
  mail: EnvelopeIcon,
  smartphone: DeviceMobileIcon,
  school: BooksIcon,
  university: BooksIcon,
  baby: BabyIcon,
  "moon-star": MoonStarsIcon,
  church: ChurchIcon,
  "book-open": BookOpenIcon,
  cross: FirstAidIcon,
  droplets: DropIcon,
  "heart-pulse": HeartbeatIcon,
  pill: PillIcon,
  palette: PaletteIcon,
  paintbrush: PaintBrushIcon,
};

const boldIcons = new Set([
  "handshake",
  "network",
  "route",
  "scroll-text",
  "scale",
  "moon-star",
  "book-open",
  "paintbrush",
]);

const subcategoryIcons: Record<string, string> = {
  "citizen-service-centers": "handshake",
  "municipality-buildings": "building-2",
  municipalities: "building",
  ministries: "building",
  "central-directorates": "network",
  "embassies-consulates": "globe",
  courts: "scale",
  "police-stations": "shield",
  banks: "banknote",
  atm: "credit-card",
  parks: "tree-pine",
  squares: "land-plot",
  "departure-centers": "bus-front",
  "interchange-centers": "route",
  airports: "plane",
  "historic-landmarks": "castle",
  "rubble-dumps": "trash-2",
  "immigration-passports": "id-card",
  entertainment: "ferris-wheel",
  stadiums: "trophy",
  cinemas: "clapperboard",
  theaters: "drama",
  "opera-house": "music-2",
  "commercial-markets": "store",
  malls: "shopping-bag",
  "post-offices": "mail",
  "mobile-service-centers": "smartphone",
  schools: "school",
  colleges: "university",
  kindegartens: "baby",
  mosques: "moon-star",
  churches: "church",
  "religious-centers": "book-open",
  hospitals: "hospital",
  "blood-banks": "droplets",
  "health-centers": "heart-pulse",
  pharmacies: "pill",
  "cultural-centers": "palette",
  institutes: "book",
  directorate: "scroll-text",
  "cultural-center": "palette",
  "training-institute": "book-open",
  "applied-arts": "paintbrush",
  "music-institute": "music-2",
  "fine-arts": "palette",
};

export function getSubcategoryPinIcon(
  slug: unknown,
  icon: unknown,
  categoryIcon: unknown,
): string {
  const supplied = typeof icon === "string" ? icon.trim().toLowerCase() : "";
  if (supplied && supplied !== categoryIcon && icons[supplied]) return supplied;
  return subcategoryIcons[String(slug)] || "map-pin";
}

const imageLoads = new WeakMap<object, Map<string, Promise<void>>>();

export function getPoiPinImageId(icon: unknown): string {
  const name =
    typeof icon === "string" && icon ? icon.toLowerCase() : "map-pin";
  return `poi-pin-${name.replace(/[^a-z0-9-]/g, "-")}`;
}

export function createPoiPinSvg(iconName: string): string {
  const name = iconName.toLowerCase();
  const Icon = icons[name] ?? MapPinIcon;
  const iconSvg = renderToStaticMarkup(
    createElement(Icon, {
      size: 256,
      weight: boldIcons.has(name) ? "bold" : "fill",
    }),
  );
  const iconPaths = iconSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="136" viewBox="0 0 56 68"><path d="M28 2C13.7 2 2 13.7 2 28c0 18.3 26 38 26 38s26-19.7 26-38C54 13.7 42.3 2 28 2Z" fill="#c8a76a" stroke="#fff" stroke-width="3"/><svg x="15" y="12" width="26" height="26" viewBox="0 0 256 256" fill="#064239">${iconPaths}</svg></svg>`;
}

export function registerPoiPinIcons(
  map: MapLibreMap,
  iconNames: unknown[],
): Promise<void> {
  let pending = imageLoads.get(map);
  if (!pending) {
    pending = new Map();
    imageLoads.set(map, pending);
  }

  return Promise.all(
    [
      ...new Set(
        iconNames.map((name) => (typeof name === "string" ? name : "map-pin")),
      ),
    ].map((iconName) => {
      const id = getPoiPinImageId(iconName);
      if (map.hasImage(id)) return Promise.resolve();
      const existing = pending!.get(id);
      if (existing) return existing;

      const promise = new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          try {
            if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = () =>
          reject(new Error(`Could not create map icon: ${iconName}`));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createPoiPinSvg(iconName))}`;
      }).finally(() => pending!.delete(id));
      pending.set(id, promise);
      return promise;
    }),
  ).then(() => undefined);
}
