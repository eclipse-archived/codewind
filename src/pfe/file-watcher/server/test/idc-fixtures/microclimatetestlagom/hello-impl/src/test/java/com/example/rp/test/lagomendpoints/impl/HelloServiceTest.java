package com.example.rp.test.lagomendpoints.impl;

import org.junit.Test;

import com.example.rp.test.lagomendpoints.api.HelloService;

import static com.lightbend.lagom.javadsl.testkit.ServiceTest.defaultSetup;
import static com.lightbend.lagom.javadsl.testkit.ServiceTest.withServer;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.Assert.assertEquals;

public class HelloServiceTest {
    @Test
    public void shouldGreet() {
        withServer(defaultSetup(), server -> {
            HelloService service = server.client(HelloService.class);

            String msg1 = service.hello("Alice").invoke().toCompletableFuture().get(5, SECONDS);
            assertEquals("hello: Alice", msg1);
        });
    }
}
