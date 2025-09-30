{ pkgs }:
{
  deps = [
    pkgs.nodejs_20
    pkgs.postgresql
    pkgs.cacert
    pkgs.bash
    pkgs.curl
    pkgs.git
  ];
}

