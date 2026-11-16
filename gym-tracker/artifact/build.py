#!/usr/bin/env python3
"""Builds the single-file page for publishing as a Claude artifact.
Usage: python3 artifact/build.py <output.html>   (run from gym-tracker/)"""
import pathlib, sys
here = pathlib.Path(__file__).resolve().parent
read = lambda p: (here / p).read_text()
sys.stdout = open(sys.argv[1], 'w')
print(f"""<title>Gym Tracker</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap">
<style>
{read('../gym-tracker.css')}
html, body {{ height: 100%; }}
body {{ background: var(--gt-bg); color: var(--gt-fg); }}
#gym {{ height: 100%; }}
</style>
<div id="gym"></div>
<script>
{read('../gym-tracker.js')}
{read('sync.js')}
</script>""")
