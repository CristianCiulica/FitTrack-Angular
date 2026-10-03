package com.fittrack.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class RunTrackingMathTest {
    @Test public void acceptsRunningAtPlausibleSpeed() {
        assertTrue(RunTrackingMath.acceptSegment(12, 4, 10));
    }
    @Test public void rejectsStationaryJitterAndPoorAccuracy() {
        assertFalse(RunTrackingMath.acceptSegment(3, 1, 5));
        assertFalse(RunTrackingMath.acceptSegment(8, 4, 30));
        assertFalse(RunTrackingMath.acceptSegment(20, 10, 51));
    }
    @Test public void rejectsTeleportAndOutOfOrderPositions() {
        assertFalse(RunTrackingMath.acceptSegment(100, 1, 5));
        assertFalse(RunTrackingMath.acceptSegment(10, 0, 5));
        assertFalse(RunTrackingMath.acceptSegment(10, -2, 5));
    }
    @Test public void rejectsLongGapsAndInvalidNumbers() {
        assertFalse(RunTrackingMath.acceptSegment(500, 120, 5));
        assertFalse(RunTrackingMath.acceptSegment(Double.NaN, 3, 5));
        assertFalse(RunTrackingMath.acceptSegment(10, 3, Double.NaN));
    }
}
