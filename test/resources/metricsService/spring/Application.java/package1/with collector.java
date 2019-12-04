package application;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.ibm.javametrics.codewind.spring", "application"})
public class SBApplication {

    public static void main(String[] args) {
        SpringApplication.run(SBApplication.class, args);
    }
}
