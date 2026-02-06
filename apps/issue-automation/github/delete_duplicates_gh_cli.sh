#!/bin/bash
# Delete closed duplicate issues using GitHub CLI
# This script permanently deletes issues from GitHub (cannot be recovered)

set -e

# Load environment variables
if [ -f .env.issue ]; then
    set -a
    source .env.issue
    set +a
fi

REPO="${GITHUB_OWNER}/${GITHUB_REPO}"
DRY_RUN="${1:-true}"

# List of duplicate issue numbers to delete (keeping the first occurrence)
DUPLICATES=(
    309 308 307 306 305 304 303 302 301 300
    299 298 297 296 295 294 293 292 291 290
    289 288 286 285 284 283 282 281 280 279
    278 277 276 272 271 270 269 268 267 266
    265 264 263 262 261 260 259 258 257 256
    255 254 253 252 251 250 249 248 247 246
    245 244 243 242 241 240
)

echo "Repository: $REPO"
echo "Issues to delete: ${#DUPLICATES[@]}"
echo ""

if [ "$DRY_RUN" = "true" ] || [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] Would delete the following issues:"
    for issue_num in "${DUPLICATES[@]}"; do
        echo "  - #$issue_num"
    done
    echo ""
    echo "To actually delete, run:"
    echo "  $0 false"
    exit 0
fi

echo "WARNING: This will PERMANENTLY DELETE ${#DUPLICATES[@]} issues!"
echo "This action cannot be undone."
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Deleting issues..."

deleted=0
failed=0

for issue_num in "${DUPLICATES[@]}"; do
    if gh issue delete "$issue_num" --repo "$REPO" --yes 2>/dev/null; then
        echo "✓ Deleted issue #$issue_num"
        deleted=$((deleted + 1))
        # Rate limiting: wait 1 second between deletions
        sleep 1
    else
        echo "✗ Failed to delete issue #$issue_num"
        failed=$((failed + 1))
    fi
done

echo ""
echo "Summary:"
echo "  Deleted: $deleted issues"
if [ $failed -gt 0 ]; then
    echo "  Failed: $failed issues"
fi

