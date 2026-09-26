package com.taskboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class TaskBoardApplication {

    public static void main(String[] args) {
        SpringApplication.run(TaskBoardApplication.class, args);
    }
}
