#!/bin/bash
# gen-srcinfo.sh — emit .SRCINFO for the podtui-bin PKGBUILD without makepkg.
# Emits the same field set/ordering makepkg --printsrcinfo produces for this
# PKGBUILD shape (single package, per-arch source + sha256sums arrays).
set -euo pipefail

cd "$(dirname "$0")"

# shellcheck disable=SC1091
. ./PKGBUILD

emit() { printf '\t%s = %s\n' "$1" "$2"; }
emit_multi() { # $1 field, rest values
	local f="$1"
	shift
	for v in "$@"; do emit "$f" "$v"; done
}

pkgbase_section() {
	echo "pkgbase = ${pkgname}"
	for f in pkgdesc pkgver pkgrel url; do
		v="${!f}"
		[ -n "${v:-}" ] && emit "$f" "$v"
	done
	[ -n "${install:-}" ] && emit install "$install"
	[ "${#arch[@]}" -gt 0 ] && emit_multi arch "${arch[@]}"
	[ "${#license[@]}" -gt 0 ] && emit_multi license "${license[@]}"
	[ "${#depends[@]}" -gt 0 ] && emit_multi depends "${depends[@]}"
	[ "${#provides[@]}" -gt 0 ] && emit_multi provides "${provides[@]}"
	[ "${#conflicts[@]}" -gt 0 ] && emit_multi conflicts "${conflicts[@]}"
	[ "${#options[@]}" -gt 0 ] && emit_multi options "${options[@]}"
	emit_arch_arrays
}

emit_arch_arrays() {
	for a in "${arch[@]}"; do
		src_name="source_${a}"
		sha_name="sha256sums_${a}"
		src_val="${src_name}[@]"
		sha_val="${sha_name}[@]"
		[ "${#src_name}" -gt 0 ] && emit_multi "source_${a}" "${!src_val}"
		emit_multi "sha256sums_${a}" "${!sha_val}"
	done
}

pkgbase_section
echo ""
echo "pkgname = ${pkgname}"
for v in pkgver pkgrel url; do
	val="${!v}"
	[ -n "${val:-}" ] && emit "$v" "$val"
done
emit pkgdesc "$pkgdesc"
[ "${#arch[@]}" -gt 0 ] && emit_multi arch "${arch[@]}"
[ "${#license[@]}" -gt 0 ] && emit_multi license "${license[@]}"
[ "${#depends[@]}" -gt 0 ] && emit_multi depends "${depends[@]}"
[ "${#provides[@]}" -gt 0 ] && emit_multi provides "${provides[@]}"
[ "${#conflicts[@]}" -gt 0 ] && emit_multi conflicts "${conflicts[@]}"
[ "${#options[@]}" -gt 0 ] && emit_multi options "${options[@]}"
emit_arch_arrays
