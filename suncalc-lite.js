/*
 * Small SunCalc-compatible subset for this app.
 * Based on the public-domain NOAA solar calculations and SunCalc's API shape.
 */
(function exposeSunCalc(global) {
  const dayMs = 86400000;
  const j1970 = 2440588;
  const j2000 = 2451545;
  const rad = Math.PI / 180;
  const e = rad * 23.4397;

  const toJulian = (date) => date.valueOf() / dayMs - 0.5 + j1970;
  const fromJulian = (julian) => new Date((julian + 0.5 - j1970) * dayMs);
  const toDays = (date) => toJulian(date) - j2000;

  const rightAscension = (lambda, beta) =>
    Math.atan2(Math.sin(lambda) * Math.cos(e) - Math.tan(beta) * Math.sin(e), Math.cos(lambda));
  const declination = (lambda, beta) =>
    Math.asin(Math.sin(beta) * Math.cos(e) + Math.cos(beta) * Math.sin(e) * Math.sin(lambda));
  const azimuth = (hourAngle, phi, dec) =>
    Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const altitude = (hourAngle, phi, dec) =>
    Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));
  const siderealTime = (days, lw) => rad * (280.16 + 360.9856235 * days) - lw;
  const solarMeanAnomaly = (days) => rad * (357.5291 + 0.98560028 * days);
  const eclipticLongitude = (meanAnomaly) => {
    const center = rad * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly));
    const perihelion = rad * 102.9372;
    return meanAnomaly + center + perihelion + Math.PI;
  };

  function sunCoords(days) {
    const meanAnomaly = solarMeanAnomaly(days);
    const lambda = eclipticLongitude(meanAnomaly);
    return {
      dec: declination(lambda, 0),
      ra: rightAscension(lambda, 0)
    };
  }

  function getPosition(date, latitude, longitude) {
    const lw = rad * -longitude;
    const phi = rad * latitude;
    const days = toDays(date);
    const coords = sunCoords(days);
    const hourAngle = siderealTime(days, lw) - coords.ra;

    return {
      azimuth: azimuth(hourAngle, phi, coords.dec),
      altitude: altitude(hourAngle, phi, coords.dec)
    };
  }

  const julianCycle = (days, lw) => Math.round(days - 0.0009 - lw / (2 * Math.PI));
  const approxTransit = (hourAngle, lw, cycle) => 0.0009 + (hourAngle + lw) / (2 * Math.PI) + cycle;
  const solarTransitJ = (ds, meanAnomaly, lambda) =>
    j2000 + ds + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * lambda);
  const hourAngle = (height, phi, dec) =>
    Math.acos((Math.sin(height) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

  function getSetJ(height, lw, phi, dec, cycle, meanAnomaly, lambda) {
    const angle = hourAngle(height, phi, dec);
    const setTransit = approxTransit(angle, lw, cycle);
    return solarTransitJ(setTransit, meanAnomaly, lambda);
  }

  function getTimes(date, latitude, longitude) {
    const lw = rad * -longitude;
    const phi = rad * latitude;
    const days = toDays(date);
    const cycle = julianCycle(days, lw);
    const ds = approxTransit(0, lw, cycle);
    const meanAnomaly = solarMeanAnomaly(ds);
    const lambda = eclipticLongitude(meanAnomaly);
    const dec = declination(lambda, 0);
    const noon = solarTransitJ(ds, meanAnomaly, lambda);
    const set = getSetJ(-0.833 * rad, lw, phi, dec, cycle, meanAnomaly, lambda);
    const rise = noon - (set - noon);

    return {
      solarNoon: fromJulian(noon),
      sunrise: fromJulian(rise),
      sunset: fromJulian(set)
    };
  }

  global.SunCalc = { getPosition, getTimes };
})(window);
