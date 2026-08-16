class Omniops < Formula
  desc "Self-Hosted OmniOps Engine for Podman & Docker"
  homepage "https://github.com/reizhafajrian/omniops"
  version "0.1.0"
  
  if OS.mac?
    if Hardware::CPU.intel?
      url "https://github.com/reizhafajrian/omniops/releases/download/v0.1.0/omniops-x86_64-apple-darwin.tar.gz"
      sha256 "REPLACE_WITH_SHA256"
    elsif Hardware::CPU.arm?
      url "https://github.com/reizhafajrian/omniops/releases/download/v0.1.0/omniops-aarch64-apple-darwin.tar.gz"
      sha256 "REPLACE_WITH_SHA256"
    end
  elsif OS.linux?
    if Hardware::CPU.intel?
      url "https://github.com/reizhafajrian/omniops/releases/download/v0.1.0/omniops-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "REPLACE_WITH_SHA256"
    elsif Hardware::CPU.arm?
      url "https://github.com/reizhafajrian/omniops/releases/download/v0.1.0/omniops-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "REPLACE_WITH_SHA256"
    end
  end

  def install
    bin.install "omniops"
  end

  test do
    system "#{bin}/omniops", "--version"
  end
end
