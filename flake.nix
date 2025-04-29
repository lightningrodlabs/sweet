{
  description = "Flake for Holochain app development";

  inputs = {
    holonix.url = "github:LeosPrograms/holonix?ref=main-0.4";

    nixpkgs.follows = "holonix/nixpkgs";
    flake-parts.follows = "holonix/flake-parts";
  };

  outputs = inputs@{ flake-parts, ... }: flake-parts.lib.mkFlake { inherit inputs; } {
    systems = builtins.attrNames inputs.holonix.devShells;
    perSystem = { inputs', pkgs, ... }:

      let
        cargoExtraArgs = "--features wasmer_sys,sqlite-encrypted,tx5,raft";
        customHolochain = inputs'.holonix.packages.holochain.override { inherit cargoExtraArgs; };

        formatter = pkgs.nixpkgs-fmt;
      in
      {
        devShells.default = pkgs.mkShell {
          packages = (with inputs'.holonix.packages; [
            customHolochain
            lair-keystore
            hc-launch
            hc-scaffold
            hn-introspect
            rust # For Rust development, with the WASM target included for zome builds
          ]) ++ (with pkgs; [
            nodejs_20 # For UI development
            binaryen # For WASM optimisation
            # Add any other packages you need here
          ]);

          shellHook = ''
            export PS1='\[\033[1;34m\][holonix:\w]\$\[\033[0m\] '
          '';
        };
    };
  };
}
