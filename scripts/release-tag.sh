#!/bin/bash

# release-tag.sh — PodTui version bump, commit, tag, and push.
#
# Mirrors the release flow from FlexLove's scripts/make-tag.sh, adapted for
# PodTui's single version source (src/index.tsx) and dual remotes (gh, gt).
#
# Usage:
#   scripts/release-tag.sh            interactive release
#   scripts/release-tag.sh --dry-run  plan the bump/tag/pushes without doing
#
# Pushing a v* tag to the `gh` remote triggers .github/workflows/release.yml
# (4-platform tarball builds) — the release and the Homebrew tap update then
# happen automatically and need no further local action.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

DRY_RUN=0
for arg in "$@"; do
	case "$arg" in
	--dry-run | -n) DRY_RUN=1 ;;
	--help | -h)
		echo "Usage: scripts/release-tag.sh [--dry-run]"
		echo "  --dry-run, -n   show the plan without committing, tagging, or pushing"
		exit 0
		;;
	*)
		echo -e "${RED}Unknown option: ${arg}${NC}" >&2
		exit 2
		;;
	esac
done

if [ ! -d .git ] && [ ! -f .git ]; then
	echo -e "${RED}Error: Not in a git repository${NC}"
	exit 1
fi

if ! git diff-index --quiet HEAD --; then
	echo -e "${YELLOW}You have uncommitted changes:${NC}"
	git status --short
	echo ""
	read -p "Continue anyway? (y/n) " -n 1 -r
	echo
	if [[ ! $REPLY =~ ^[Yy]$ ]]; then
		echo -e "${RED}Aborted${NC}"
		exit 1
	fi
	echo ""
fi

# Current version from the latest tag; fall back to src/index.tsx.
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')
if [ -z "$CURRENT_VERSION" ]; then
	CURRENT_VERSION=$(grep -m 1 "^const VERSION" src/index.tsx | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
	if [ -z "$CURRENT_VERSION" ]; then
		echo -e "${RED}Error: could not extract version from git tags or src/index.tsx${NC}"
		exit 1
	fi
	echo -e "${YELLOW}No tags found; using VERSION from src/index.tsx (${CURRENT_VERSION})${NC}"
fi

echo -e "${CYAN}Current version:${NC} ${GREEN}v${CURRENT_VERSION}${NC}"
echo ""

IFS='.' read -r MAJOR MINOR PATCH <<<"$CURRENT_VERSION"
MAJOR=$(echo "$MAJOR" | sed 's/[^0-9].*//')
MINOR=$(echo "$MINOR" | sed 's/[^0-9].*//')
PATCH=$(echo "$PATCH" | sed 's/[^0-9].*//')

echo -e "${CYAN}Select version bump type:${NC}"
echo "  1) Major (breaking changes)     ${MAJOR}.${MINOR}.${PATCH} → $((MAJOR + 1)).0.0"
echo "  2) Minor (new features)          ${MAJOR}.${MINOR}.${PATCH} → ${MAJOR}.$((MINOR + 1)).0"
echo "  3) Patch (bug fixes)             ${MAJOR}.${MINOR}.${PATCH} → ${MAJOR}.${MINOR}.$((PATCH + 1))"
echo "  4) Custom version"
echo "  5) Cancel"
echo ""
read -p "Enter choice (1-5): " -n 1 -r CHOICE
echo ""
echo ""

case $CHOICE in
1)
	NEW_VERSION="$((MAJOR + 1)).0.0"
	;;
2)
	NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
	;;
3)
	NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
	;;
4)
	read -p "Enter custom version (e.g., 1.0.0-beta): " -r NEW_VERSION
	;;
5)
	echo -e "${RED}Cancelled${NC}"
	exit 0
	;;
*)
	echo -e "${RED}Invalid choice${NC}"
	exit 1
	;;
esac

# Version sanity check (tags are vMAJOR.MINOR.PATCH).
if ! echo "$NEW_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
	echo -e "${RED}Error: ${NEW_VERSION} is not a valid X.Y.Z version (v tags only)${NC}"
	exit 1
fi

echo -e "${CYAN}New version:${NC} ${GREEN}v${NEW_VERSION}${NC}"
echo ""
echo -e "${YELLOW}This will:${NC}"
echo "  1. Set src/index.tsx → VERSION = \"${NEW_VERSION}\""
echo "  2. Commit the bump"
echo "  3. Create annotated tag v${NEW_VERSION}"
echo "  4. Push master and the tag to every remote"
REMOTES=$(git remote)
for r in $REMOTES; do
	echo "       → $r"
done
echo ""
echo -e "${YELLOW}Note: pushing the tag to ${BLUE}gh${YELLOW} triggers release.yml CI (4-platform"
echo "binaries + GitHub Release) and the homebrew-podtui tap update.${NC}"
echo ""
read -p "Proceed? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
	echo -e "${YELLOW}Aborted — no changes made${NC}"
	exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
	echo ""
	echo -e "${CYAN}[dry-run]${NC} would have:"
	echo "  sed  src/index.tsx: VERSION \"${CURRENT_VERSION}\" → \"${NEW_VERSION}\""
	echo "  git  commit -m \"bump VERSION to ${NEW_VERSION}\""
	echo "  git  tag -a v${NEW_VERSION} -m \"PodTUI v${NEW_VERSION}\""
	for r in $REMOTES; do echo "  push $r master"; done
	for r in $REMOTES; do echo "  push $r v${NEW_VERSION}"; done
	echo ""
	echo -e "${GREEN}Plan only — nothing written${NC}"
	exit 0
fi

# ── Apply the bump ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[1/4]${NC} Updating src/index.tsx..."
sed -i.bak "s/const VERSION = \"[^\"]*\"/const VERSION = \"${NEW_VERSION}\"/" src/index.tsx
rm -f src/index.tsx.bak
echo -e "${GREEN}✓ src/index.tsx updated${NC}"

if git diff --quiet -- src/index.tsx; then
	if git rev-parse -q --verify "refs/tags/v${NEW_VERSION}" >/dev/null; then
		echo -e "${YELLOW}Already at ${NEW_VERSION} and tag v${NEW_VERSION} exists — nothing to release.${NC}"
		exit 0
	fi
	echo -e "${YELLOW}VERSION is already ${NEW_VERSION} (bump already committed).${NC}"
	echo -e "${YELLOW}Will skip the commit and just create the missing tag + push.${NC}"
	read -p "Tag v${NEW_VERSION} on current HEAD and push? (y/n) " -n 1 -r
	echo
	if [[ ! $REPLY =~ ^[Yy]$ ]]; then
		echo -e "${YELLOW}Aborted — no changes made${NC}"
		exit 0
	fi
else
	git add src/index.tsx
	echo -e "${GREEN}✓ staged${NC}"

	echo -e "${CYAN}[2/4]${NC} Committing..."
	DEFAULT_COMMIT_MSG="bump VERSION to ${NEW_VERSION}"
	echo -e "Default commit message: ${CYAN}${DEFAULT_COMMIT_MSG}${NC}"
	read -p "Use default? (y/n) " -n 1 -r
	echo
	if [[ $REPLY =~ ^[Nn]$ ]]; then
		read -p "Enter commit message: " -r COMMIT_MSG
	else
		COMMIT_MSG="$DEFAULT_COMMIT_MSG"
	fi
	git commit -m "$COMMIT_MSG"
	echo -e "${GREEN}✓ committed: ${COMMIT_MSG}${NC}"
fi

echo -e "${CYAN}[3/4]${NC} Tagging..."
git tag -a "v${NEW_VERSION}" -m "PodTUI v${NEW_VERSION}"
echo -e "${GREEN}✓ tagged v${NEW_VERSION}${NC}"
echo ""

echo -e "${CYAN}[4/4]${NC} Pushing..."
FAILED=""
for r in $REMOTES; do
	if ! git push "$r" master; then
		FAILED="${FAILED}${r} (branch) "
	fi
	if ! git push "$r" tag "v${NEW_VERSION}"; then
		FAILED="${FAILED}${r} (tag) "
	fi
done

echo ""
if [ -n "$FAILED" ]; then
	echo -e "${RED}═══════════════════════════════════════${NC}"
	echo -e "${RED}✗ Push failed for: ${FAILED}${NC}"
	echo -e "${RED}═══════════════════════════════════════${NC}"
	echo ""
	echo -e "${YELLOW}The commit and tag exist locally. To retry:${NC}"
	for r in $REMOTES; do
		echo "  git push ${r} master"
		echo "  git push ${r} v${NEW_VERSION}"
	done
	echo ""
	echo -e "${YELLOW}To undo:${NC}"
	echo "  git tag -d v${NEW_VERSION}"
	echo "  git reset --soft HEAD~1"
	exit 1
fi

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✓ PodTui v${NEW_VERSION} released${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Version:${NC} ${CURRENT_VERSION} → ${GREEN}${NEW_VERSION}${NC}"
echo -e "${CYAN}Tag:${NC} v${NEW_VERSION}"
echo ""
echo -e "${BLUE}Next steps (automatic, nothing to do):${NC}"
echo "  1. GitHub Action release.yml builds 4 tarballs and attaches them:"
echo -e "     ${CYAN}gh run watch \$(gh run list --limit 1 --json databaseId -q .[0].databaseId)${NC}"
echo "  2. mikefreno/homebrew-podtui self-updates within the hour (Formula"
echo "     URLs + sha256s); brew upgrade podtui afterwards."
