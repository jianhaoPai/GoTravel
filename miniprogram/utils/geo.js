function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(a, b) {
  if (!a || !b) return 0;

  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function routeStats(places) {
  let totalKm = 0;

  for (let i = 1; i < places.length; i += 1) {
    totalKm += distanceKm(places[i - 1], places[i]);
  }

  const minutes = Math.max(0, Math.round((totalKm / 18) * 60));

  return {
    distanceText: totalKm < 1 ? `${Math.round(totalKm * 1000)} m` : `${totalKm.toFixed(1)} km`,
    durationText: minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
  };
}

module.exports = {
  distanceKm,
  routeStats
};
