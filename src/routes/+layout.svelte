<script>
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(*) { margin: 0; padding: 0; box-sizing: border-box; }
	:global(html, body) { height: 100%; overflow: hidden; }
	:global(body) {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		background: #050b12;
		color: #e8eef2;
	}
	:global(canvas) { display: block; }
</style>
