# PHC Wires Art

This is the second version of the _wire art_ for the landing page of the new PHC website.

The first version stored wires as polylines so when adding a new wire to the world we had to compute if the new wire intersected any of the previous one and that was _O(|number of segments of current wire| * |number of segments in whole canvas|)_ and it got pretty slow after some time.

Instead this version uses the fact that all segments lie on a grid and can be only of three kinds (going down, down left or down right) and stores them in a "2d integer hashmap" (in js this is just an object indexed by `<x>,<y>` for example `0,0` or `-15,7`) for fast access, this way computing intersections doesn't depend on the number of wires present in the world state and is just _O(|number of segments of current wire|)_.

Another improvement is that the screen is redrawn only when considered `dirty` (the update functions sets this to true after modifying the world state).

## Usage

This project just uses ViteJS.

First setup the project with `npm install` or <code>[pnpm](https://pnpm.io/) install</code>.

Then use `npm run dev` for a local dev server and `npm run build` to build the `dist/` folder.
