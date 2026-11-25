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
    @Test public void interpolatesSecondKilometreOnResumedActiveClock() {
        assertEquals(606, RunTrackingMath.crossingTime(1970, 50, 1, 600, 610), 1e-9);
    }
    @Test public void recordsBoundaryExactlyOnce() {
        assertTrue(Double.isNaN(RunTrackingMath.crossingTime(990, 8, 0, 299, 300)));
        assertEquals(301, RunTrackingMath.crossingTime(998, 2, 0, 300, 301), 1e-9);
        assertTrue(Double.isNaN(RunTrackingMath.crossingTime(1000, 5, 1, 301, 302)));
    }
}
