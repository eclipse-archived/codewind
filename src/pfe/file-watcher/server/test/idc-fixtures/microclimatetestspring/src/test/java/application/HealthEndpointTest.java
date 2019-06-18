package application;

import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.junit.runner.RunWith;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.embedded.LocalServerPort;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
public class HealthEndpointTest {

    @Autowired
    private TestRestTemplate server;

    @LocalServerPort
    private int port;

    @Test
    public void testEndpoint() throws Exception {
        String endpoint = "http://localhost:" + port + "/health";
        String response = server.getForObject(endpoint, String.class);
        assertTrue("Invalid response from server : " + response, response.startsWith("{\"status\":\"UP\""));
    }

}
