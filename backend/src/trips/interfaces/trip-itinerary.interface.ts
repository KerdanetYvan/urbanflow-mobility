/** Forme renvoyee par GET /trips (issue #7) - un itineraire multimodal decoupe en segments. */

export interface TripPlace {
  name: string;
  lat: number;
  lon: number;
}

export interface TripSegment {
  /** Mode de transport du segment tel que renvoye par OTP (ex. "WALK", "BUS"). */
  mode: string;
  /** Nom de la ligne (ex. "T1") - absent pour un segment a pied. */
  routeName?: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  distanceMeters: number;
  from: TripPlace;
  to: TripPlace;
}

export interface TripItinerary {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  transfers: number;
  segments: TripSegment[];
}
