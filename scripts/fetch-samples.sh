#!/usr/bin/env bash
# Downloads the default drum samples (CC0, Karoryfer/sfzinstruments "Virtuosity Drums")
# into public/samples. To use another kit: replace the files and edit public/samples/manifest.json.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="https://raw.githubusercontent.com/sfzinstruments/virtuosity_drums/master/Samples/mid"
OUT=public/samples
mkdir -p "$OUT"

# instrument|source path|ghost|normal|accent layer names (vlN) , rr suffix handled in name
get() { # out-name source-path
  [ -s "$OUT/$1" ] || curl -fsSL "$BASE/$2" -o "$OUT/$1"
}
fetch() { # inst folder prefix vl_ghost vl_normal vl_accent [rr]
  local rr="${7:+_rr$7}"
  get "$1-1.flac" "$2/${3}_vl$4${rr}.flac"
  get "$1-2.flac" "$2/${3}_vl$5${rr}.flac"
  get "$1-3.flac" "$2/${3}_vl$6${rr}.flac"
}
fetch kick     kick  mid_kick_snoff     1 3 4 1
fetch snare    snare mid_snare_center   4 9 15
fetch hhClosed hh    mid_hh_closed      1 3 4 1
fetch hhOpen   hh    mid_hh_open        1 3 4 1
fetch tomHigh  htom  mid_htom_center    4 9 14
fetch tomLow   ltom  mid_ltom_center    4 9 14
fetch crash    crash mid_crash_crash    1 2 3 1
fetch ride     ride  mid_ride_ride      1 2 3 1
# tomMid reuses the high tom sample pitched down (see manifest "rate")
cp -n "$OUT/tomHigh-1.flac" "$OUT/tomMid-1.flac"
cp -n "$OUT/tomHigh-2.flac" "$OUT/tomMid-2.flac"
cp -n "$OUT/tomHigh-3.flac" "$OUT/tomMid-3.flac"
echo "samples ok: $(du -sh "$OUT" | cut -f1)"
