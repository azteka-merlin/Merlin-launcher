#!/bin/bash
# Build script for CloudRedirect Flatpak. LOCAL TEST INSTALL ONLY.
# For distributable builds, use release.sh (signs the OSTree summary).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

MANIFEST="$SCRIPT_DIR/org.cloudredirect.CloudRedirect.yml"

echo "=== CloudRedirect Flatpak Build ==="

FS_TYPE="$(stat -f -c %T "$SCRIPT_DIR" 2>/dev/null || echo unknown)"
case "$FS_TYPE" in
    9p|v9fs|drvfs|cifs)
        echo "Error: $SCRIPT_DIR is on a $FS_TYPE mount; flatpak-builder needs a native filesystem."
        echo "Copy the tree across first, then build from there:"
        echo "  rsync -a --exclude build-dir \"$PROJECT_ROOT/\" ~/cr-build/"
        echo "  ~/cr-build/flatpak/build.sh"
        exit 1
        ;;
esac

# Check prerequisites - try native flatpak-builder first, then flatpak version
FLATPAK_BUILDER=""
if command -v flatpak-builder &> /dev/null; then
    FLATPAK_BUILDER="flatpak-builder"
elif flatpak list | grep -q "org.flatpak.Builder"; then
    FLATPAK_BUILDER="flatpak run org.flatpak.Builder"
else
    echo "Error: flatpak-builder not found. Install with:"
    echo "  flatpak install --user flathub org.flatpak.Builder"
    echo "  # or"
    echo "  sudo dnf install flatpak-builder  # Fedora"
    echo "  sudo apt install flatpak-builder  # Debian/Ubuntu"
    exit 1
fi

RUNTIME_VERSION="$(sed -n "s/^runtime-version:[[:space:]]*['\"]\?\([^'\"]*\)['\"]\?/\1/p" "$MANIFEST" | head -1)"
if [ -z "$RUNTIME_VERSION" ]; then
    echo "Error: could not read runtime-version from $MANIFEST"
    exit 1
fi
if ! flatpak list --runtime | grep -q "org.kde.Platform.*$RUNTIME_VERSION"; then
    echo "Installing KDE Platform $RUNTIME_VERSION runtime..."
    flatpak install --user -y flathub "org.kde.Platform//$RUNTIME_VERSION" "org.kde.Sdk//$RUNTIME_VERSION"
fi

# Check the binaries the manifest consumes
if [ ! -f "$SCRIPT_DIR/cloud_redirect.so" ] || [ ! -f "$SCRIPT_DIR/cloud_redirect_cli" ]; then
    echo ""
    echo "Error: cloud_redirect.so and/or cloud_redirect_cli missing from $SCRIPT_DIR"
    echo ""
    echo "Build it first. Use GCC 12 so the result stays within glibc 2.31 for SteamOS:"
    echo "  cd $PROJECT_ROOT"
    echo "  mkdir -p build && cd build"
    echo "  cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=gcc-12 -DCMAKE_CXX_COMPILER=g++-12"
    echo "  make cloud_redirect cloud_redirect_cli"
    echo "  cp cloud_redirect.so cloud_redirect_cli $SCRIPT_DIR/"
    echo ""
    echo "Or copy a pre-built .so to: $SCRIPT_DIR/cloud_redirect.so"
    exit 1
fi

echo "Building Flatpak..."
cd "$SCRIPT_DIR"

$FLATPAK_BUILDER \
    --user \
    --install \
    --force-clean \
    build-dir \
    org.cloudredirect.CloudRedirect.yml

echo ""
echo "=== Build Complete ==="
echo ""
echo "Run with:"
echo "  flatpak run org.cloudredirect.CloudRedirect"
echo ""
echo "To create a distributable bundle:"
echo "  flatpak build-bundle ~/.local/share/flatpak/repo cloudredirect.flatpak org.cloudredirect.CloudRedirect"
