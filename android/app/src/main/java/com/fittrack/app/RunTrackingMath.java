package com.fittrack.app;

/** Reject stationary GPS jitter, jumps and gaps before adding route distance. */
final class RunTrackingMath {
    private RunTrackingMath() {}

    static boolean acceptSegment(double distance, double seconds, double accuracy) {
        return Double.isFinite(distance) && Double.isFinite(seconds) && Double.isFinite(accuracy)
            && accuracy >= 0 && accuracy <= 50 && seconds > 0 && seconds <= 60
            && distance >= Math.max(4, Math.min(12, accuracy * 0.4))
            && distance / seconds <= 12;
    }
}
