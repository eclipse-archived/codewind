package application.rest;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component
public class HealthEndpoint implements HealthIndicator {

  @Override
  public Health health() {
    /*
    if (!healthy) {
      return Health.down().withDetail("Not healthy", 500).build();
    }
    */
    return Health.up().build();
  }
}
