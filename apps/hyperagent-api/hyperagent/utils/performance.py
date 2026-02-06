"""Performance optimization utilities"""

import asyncio
import cProfile
import functools
import io
import pstats
import time
from collections import defaultdict
from typing import Any, Callable, Dict


class PerformanceProfiler:
    """
    Performance Profiler

    Concept: Measure and optimize code performance
    Logic: Track execution time, identify bottlenecks
    Usage: Decorator or context manager
    """

    def __init__(self):
        self.metrics: Dict[str, list] = defaultdict(list)

    def track(self, name: str):
        """Decorator to track function performance"""

        def decorator(func: Callable):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                start = time.time()
                try:
                    result = await func(*args, **kwargs)
                    return result
                finally:
                    duration = time.time() - start
                    self.metrics[name].append(duration)

            return async_wrapper

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start
                self.metrics[name].append(duration)

        return decorator if asyncio.iscoroutinefunction(func) else sync_wrapper

    def get_stats(self, name: str) -> Dict[str, float]:
        """Get performance statistics for a function"""
        if name not in self.metrics or not self.metrics[name]:
            return {}

        times = self.metrics[name]
        return {
            "count": len(times),
            "total": sum(times),
            "avg": sum(times) / len(times),
            "min": min(times),
            "max": max(times),
            "p50": sorted(times)[len(times) // 2],
            "p95": sorted(times)[int(len(times) * 0.95)],
            "p99": sorted(times)[int(len(times) * 0.99)],
        }

    def print_report(self):
        """Print performance report"""
        print("\n[*] Performance Report")
        print("=" * 60)
        for name in sorted(self.metrics.keys()):
            stats = self.get_stats(name)
            if stats:
                print(f"\n{name}:")
                print(f"  Count: {stats['count']}")
                print(f"  Avg: {stats['avg']:.3f}s")
                print(f"  Min: {stats['min']:.3f}s")
                print(f"  Max: {stats['max']:.3f}s")
                print(f"  P95: {stats['p95']:.3f}s")
                print(f"  P99: {stats['p99']:.3f}s")


def profile_function(func: Callable) -> Callable:
    """
    Profile function execution

    Usage:
        @profile_function
        def my_function():
            # code to profile
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        profiler = cProfile.Profile()
        profiler.enable()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            profiler.disable()
            s = io.StringIO()
            ps = pstats.Stats(profiler, stream=s).sort_stats("cumulative")
            ps.print_stats(20)  # Top 20 functions
            print(s.getvalue())

    return wrapper


class CacheOptimizer:
    """
    Cache Optimizer

    Concept: Intelligent caching to reduce redundant operations
    Logic: Cache expensive operations with TTL
    Usage: Decorator for function caching
    """

    def __init__(self, ttl: int = 3600):
        self.cache: Dict[str, tuple] = {}
        self.ttl = ttl

    def cached(self, key_func: Callable = None):
        """
        Cache function results

        Args:
            key_func: Function to generate cache key from args
        """

        def decorator(func: Callable):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if key_func:
                    cache_key = key_func(*args, **kwargs)
                else:
                    cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"

                # Check cache
                if cache_key in self.cache:
                    value, timestamp = self.cache[cache_key]
                    if time.time() - timestamp < self.ttl:
                        return value

                # Execute and cache
                result = await func(*args, **kwargs)
                self.cache[cache_key] = (result, time.time())
                return result

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if key_func:
                    cache_key = key_func(*args, **kwargs)
                else:
                    cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"

                # Check cache
                if cache_key in self.cache:
                    value, timestamp = self.cache[cache_key]
                    if time.time() - timestamp < self.ttl:
                        return value

                # Execute and cache
                result = func(*args, **kwargs)
                self.cache[cache_key] = (result, time.time())
                return result

            return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

        return decorator

    def clear_cache(self):
        """Clear all cached values"""
        self.cache.clear()


# Global profiler instance
profiler = PerformanceProfiler()
